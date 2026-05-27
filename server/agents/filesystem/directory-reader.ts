import { promises as fs }   from 'node:fs';
import path                 from 'node:path';
import { getWorkspaceRoot } from '../terminal/workspace/runtime-workspace.ts';

export interface DirEntry {
  name:        string;
  relativePath: string;
  isFile:      boolean;
  isDirectory: boolean;
  size:        number;
}

export async function readDirectory(
  projectId: string,
  dirPath:   string,
  recursive: boolean = false,
): Promise<DirEntry[]> {
  const sandboxRoot = getWorkspaceRoot(projectId);
  const absPath     = path.resolve(sandboxRoot, dirPath);
  const results: DirEntry[] = [];

  async function scan(dir: string): Promise<void> {
    let entries: { name: string; isDirectory(): boolean; isFile(): boolean }[] = [];
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }

    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.git')) continue;
      const full = path.join(dir, entry.name);
      let size   = 0;
      try { size = (await fs.stat(full)).size; } catch { /* ignore */ }

      results.push({
        name:        entry.name,
        relativePath: path.relative(sandboxRoot, full),
        isFile:      entry.isFile(),
        isDirectory: entry.isDirectory(),
        size,
      });

      if (recursive && entry.isDirectory()) await scan(full);
    }
  }

  await scan(absPath);
  return results;
}

export function formatListing(entries: DirEntry[]): string {
  return entries
    .map((e) => `${e.isDirectory ? 'd' : 'f'} ${e.relativePath}${e.isDirectory ? '/' : ` (${e.size}b)`}`)
    .join('\n');
}
