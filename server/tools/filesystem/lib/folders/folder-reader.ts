import { listDirEntries, getFileStat, isDirectory } from '../utils/filesystem-utils.ts';
import { joinPath } from '../utils/path-utils.ts';
import { assertSandboxPath } from '../validation/sandbox-validator.ts';
import { assertRelativePath } from '../validation/path-validator.ts';

export interface FolderEntry {
  name: string;
  relativePath: string;
  absolutePath: string;
  isFile: boolean;
  isDirectory: boolean;
  size: number;
  modifiedAt: Date;
}

export interface ReadFolderOptions {
  sandboxRoot: string;
  path: string;
  includeHidden?: boolean;
}

export async function readFolder(opts: ReadFolderOptions): Promise<FolderEntry[]> {
  assertRelativePath(opts.path);

  const absolutePath = assertSandboxPath(opts.sandboxRoot, opts.path);

  if (!(await isDirectory(absolutePath))) {
    throw new Error(`Not a directory: "${opts.path}"`);
  }

  const entries = await listDirEntries(absolutePath);
  const results: FolderEntry[] = [];

  for (const entry of entries) {
    if (!opts.includeHidden && entry.name.startsWith('.')) continue;

    const entryAbsolute = joinPath(absolutePath, entry.name);
    const entryRelative = joinPath(opts.path, entry.name);

    try {
      const stat = await getFileStat(entryAbsolute);
      results.push({
        name: entry.name,
        relativePath: entryRelative,
        absolutePath: entryAbsolute,
        isFile: entry.isFile(),
        isDirectory: entry.isDirectory(),
        size: stat.size,
        modifiedAt: stat.modifiedAt,
      });
    } catch {
      // skip unreadable entries
    }
  }

  return results.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export async function readFolderNames(opts: ReadFolderOptions): Promise<string[]> {
  const entries = await readFolder(opts);
  return entries.map(e => e.name);
}

export async function readFileEntries(opts: ReadFolderOptions): Promise<FolderEntry[]> {
  const entries = await readFolder(opts);
  return entries.filter(e => e.isFile);
}

export async function readSubfolderEntries(opts: ReadFolderOptions): Promise<FolderEntry[]> {
  const entries = await readFolder(opts);
  return entries.filter(e => e.isDirectory);
}
