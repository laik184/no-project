import { listDirEntries, getFileStat, isDirectory } from '../utils/filesystem-utils.ts';
import { joinPath, extname } from '../utils/path-utils.ts';
import { assertSandboxPath } from '../validation/sandbox-validator.ts';
import { assertRelativePath } from '../validation/path-validator.ts';

export interface ScanEntry {
  name: string;
  relativePath: string;
  absolutePath: string;
  isFile: boolean;
  isDirectory: boolean;
  depth: number;
  size: number;
  extension: string;
}

export interface ScanOptions {
  sandboxRoot: string;
  path: string;
  maxDepth?: number;
  includeHidden?: boolean;
  extensions?: string[];
}

export interface ScanResult {
  root: string;
  entries: ScanEntry[];
  totalFiles: number;
  totalDirs: number;
  totalSize: number;
}

const DEFAULT_MAX_DEPTH = 10;
const MAX_ENTRIES = 5000;

async function scanRecursive(
  absoluteDir: string,
  relativeBase: string,
  depth: number,
  opts: ScanOptions,
  results: ScanEntry[],
): Promise<void> {
  if (depth > (opts.maxDepth ?? DEFAULT_MAX_DEPTH)) return;
  if (results.length >= MAX_ENTRIES) return;

  const entries = await listDirEntries(absoluteDir);

  for (const entry of entries) {
    if (!opts.includeHidden && entry.name.startsWith('.')) continue;

    const absPath = joinPath(absoluteDir, entry.name);
    const relPath = joinPath(relativeBase, entry.name);
    const ext = entry.isFile() ? extname(entry.name).toLowerCase() : '';

    if (opts.extensions && entry.isFile() && !opts.extensions.includes(ext)) continue;

    try {
      const stat = await getFileStat(absPath);
      results.push({
        name: entry.name,
        relativePath: relPath,
        absolutePath: absPath,
        isFile: entry.isFile(),
        isDirectory: entry.isDirectory(),
        depth,
        size: stat.size,
        extension: ext,
      });

      if (entry.isDirectory()) {
        await scanRecursive(absPath, relPath, depth + 1, opts, results);
      }
    } catch { /* skip unreadable */ }
  }
}

export async function scanFolder(opts: ScanOptions): Promise<ScanResult> {
  assertRelativePath(opts.path);
  const absolutePath = assertSandboxPath(opts.sandboxRoot, opts.path);

  if (!(await isDirectory(absolutePath))) {
    throw new Error(`Not a directory: "${opts.path}"`);
  }

  const entries: ScanEntry[] = [];
  await scanRecursive(absolutePath, opts.path, 1, opts, entries);

  return {
    root: opts.path,
    entries,
    totalFiles: entries.filter(e => e.isFile).length,
    totalDirs: entries.filter(e => e.isDirectory).length,
    totalSize: entries.filter(e => e.isFile).reduce((s, e) => s + e.size, 0),
  };
}

export async function scanFilesByExtension(
  sandboxRoot: string,
  path: string,
  extensions: string[],
): Promise<ScanEntry[]> {
  const result = await scanFolder({ sandboxRoot, path, extensions });
  return result.entries.filter(e => e.isFile);
}
