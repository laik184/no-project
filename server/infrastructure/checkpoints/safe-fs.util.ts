/**
 * safe-fs.util.ts
 * Thin safe-write layer that wraps atomicWrite + backupBeforeWrite.
 *
 * Use these helpers anywhere files must be written or deleted safely:
 *   - safeWriteFile()   — backup existing + atomic write
 *   - safeDeleteFile()  — backup existing + unlink/rmdir
 *   - safeReplaceFile() — alias for safeWriteFile (explicit intent)
 *
 * These are intentionally lightweight — they do NOT create full project
 * checkpoints (which require git + full snapshot). For full checkpoint
 * creation use checkpointStore.create() from checkpoint.service.ts.
 */

import fs   from "fs/promises";
import path from "path";
import { atomicWrite }         from "./atomic-write.util.ts";
import { backupBeforeWrite }   from "./atomic-write.util.ts";

// ── Result type ───────────────────────────────────────────────────────────────

export interface SafeWriteResult {
  ok:         boolean;
  backupPath: string | null;
  error?:     string;
}

export interface SafeDeleteResult {
  ok:          boolean;
  wasFile:     boolean;
  backupPath:  string | null;
  error?:      string;
}

// ── safeWriteFile ─────────────────────────────────────────────────────────────

/**
 * Write content to a file safely:
 * 1. If the file exists, copy it to <path>.bak before overwriting.
 * 2. Write using atomicWrite (tmp → fsync → rename).
 *
 * Returns the backup path (if a backup was made) or null.
 */
export async function safeWriteFile(
  absPath: string,
  content: string,
): Promise<SafeWriteResult> {
  try {
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    const backupPath = await backupBeforeWrite(absPath);
    await atomicWrite(absPath, content);
    return { ok: true, backupPath };
  } catch (err: any) {
    return { ok: false, backupPath: null, error: err.message };
  }
}

/**
 * Explicit alias — communicates intent to replace an existing file.
 */
export const safeReplaceFile = safeWriteFile;

// ── safeDeleteFile ────────────────────────────────────────────────────────────

/**
 * Delete a file (or empty directory) safely:
 * 1. If it's a file, back it up to <path>.bak before deleting.
 * 2. Remove the original.
 *
 * Directories are removed recursively without backup (too large to copy).
 */
export async function safeDeleteFile(
  absPath:   string,
  recursive?: boolean,
): Promise<SafeDeleteResult> {
  let stat: Awaited<ReturnType<typeof fs.stat>> | null = null;
  try {
    stat = await fs.stat(absPath);
  } catch {
    return { ok: true, wasFile: false, backupPath: null }; // already gone
  }

  const wasFile = stat.isFile();
  let backupPath: string | null = null;

  try {
    if (wasFile) {
      backupPath = await backupBeforeWrite(absPath);
      await fs.unlink(absPath);
    } else {
      await fs.rm(absPath, { recursive: recursive ?? true, force: true });
    }
    return { ok: true, wasFile, backupPath };
  } catch (err: any) {
    return { ok: false, wasFile, backupPath, error: err.message };
  }
}
