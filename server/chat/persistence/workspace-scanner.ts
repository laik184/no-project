/**
 * server/chat/persistence/workspace-scanner.ts
 *
 * Recursively scans a project directory and captures current file contents
 * as a snapshot suitable for storage in the checkpoints.fileSnapshots JSONB column.
 *
 * Rules:
 *  - Skips directories: node_modules, .git, dist, build, .next, .cache, __pycache__, .sandbox
 *  - Skips files larger than MAX_FILE_BYTES (500 KB)
 *  - Skips binary files (detected via null-byte sampling in first 8 KB)
 *  - Returns a flat map: relative-path → content (string)
 */

import fs   from 'fs/promises';
import path from 'path';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 512_000; // 500 KB

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
  '.cache', '__pycache__', '.sandbox', '.data', 'coverage',
  '.turbo', '.vercel', '.replit', 'vendor',
]);

const SKIP_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.bmp', '.tiff',
  '.mp4', '.mp3', '.wav', '.ogg', '.mov', '.avi', '.mkv',
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
  '.exe', '.bin', '.dll', '.so', '.dylib', '.wasm',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.lock',
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true if the buffer looks like binary (contains null bytes). */
function looksLikeBinary(buf: Buffer): boolean {
  const sample = buf.subarray(0, 8192);
  return sample.includes(0);
}

/** Walk a directory tree, collecting regular-file absolute paths. */
async function walk(dir: string, collector: string[]): Promise<void> {
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return;
  }

  for (const name of names) {
    const fullPath = path.join(dir, name);

    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try { stat = await fs.stat(fullPath); } catch { continue; }

    if (stat.isDirectory()) {
      if (SKIP_DIRS.has(name) || (name.startsWith('.') && SKIP_DIRS.has(name.slice(1)))) continue;
      await walk(fullPath, collector);
    } else if (stat.isFile()) {
      const ext = path.extname(name).toLowerCase();
      if (SKIP_EXTENSIONS.has(ext)) continue;
      collector.push(fullPath);
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface WorkspaceSnapshot {
  /** Flat map: relative-path (from projectDir) → file content. */
  snapshots:  Record<string, string>;
  /** Sorted list of all captured relative paths. */
  filePaths:  string[];
  /** Number of files skipped (too large or binary). */
  skipped:    number;
}

/**
 * Capture the current state of all text files under `projectDir`.
 *
 * @param projectDir  Absolute path to the project workspace root.
 * @returns           WorkspaceSnapshot with content map and statistics.
 */
export async function captureWorkspaceSnapshot(projectDir: string): Promise<WorkspaceSnapshot> {
  const allPaths: string[] = [];
  await walk(projectDir, allPaths);

  const snapshots: Record<string, string> = {};
  let skipped = 0;

  for (const abs of allPaths) {
    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stat = await fs.stat(abs);
    } catch {
      skipped++;
      continue;
    }

    if (stat.size > MAX_FILE_BYTES) { skipped++; continue; }

    let buf: Buffer;
    try {
      buf = await fs.readFile(abs);
    } catch {
      skipped++;
      continue;
    }

    if (looksLikeBinary(buf)) { skipped++; continue; }

    const rel = path.relative(projectDir, abs);
    snapshots[rel] = buf.toString('utf8');
  }

  return {
    snapshots,
    filePaths: Object.keys(snapshots).sort(),
    skipped,
  };
}
