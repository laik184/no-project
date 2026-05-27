/**
 * directory-reader.ts
 * Lists directory contents with file metadata.
 */

import fs   from 'fs/promises';
import path from 'path';
import { pathManager }       from './path-manager.ts';
import { validateFilePath }  from './validation/file-integrity.ts';

export interface DirEntry {
  name:      string;
  relativePath: string;
  type:      'file' | 'directory';
  sizeBytes?: number;
}

export interface DirListing {
  basePath: string;
  entries:  DirEntry[];
  total:    number;
}

/** List entries in a sandbox directory with optional recursion. */
export async function readDirectory(
  projectId:    string,
  relativePath: string = '.',
  recursive:    boolean = false,
): Promise<DirListing> {
  const pathCheck = validateFilePath(relativePath === '.' ? 'src' : relativePath);
  // '.' is always safe; only validate non-trivial paths
  if (relativePath !== '.' && !pathCheck.valid) {
    throw new Error(`Invalid path: ${pathCheck.reason}`);
  }

  const absBase = pathManager.resolve(projectId, relativePath);
  const entries = await collectEntries(absBase, relativePath, projectId, recursive);

  return { basePath: relativePath, entries, total: entries.length };
}

async function collectEntries(
  absDir:       string,
  relBase:      string,
  projectId:    string,
  recursive:    boolean,
): Promise<DirEntry[]> {
  const SKIP = new Set(['node_modules', '.git', '.cache', 'dist', '.data']);
  const results: DirEntry[] = [];

  let rawEntries: fs.Dirent[] = [];
  try {
    rawEntries = await fs.readdir(absDir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of rawEntries) {
    if (SKIP.has(entry.name)) continue;
    const rel = path.join(relBase, entry.name);

    if (entry.isDirectory()) {
      results.push({ name: entry.name, relativePath: rel, type: 'directory' });
      if (recursive) {
        const children = await collectEntries(
          path.join(absDir, entry.name), rel, projectId, true,
        );
        results.push(...children);
      }
    } else {
      let sizeBytes: number | undefined;
      try {
        const stat = await fs.stat(path.join(absDir, entry.name));
        sizeBytes = stat.size;
      } catch { /* skip */ }
      results.push({ name: entry.name, relativePath: rel, type: 'file', sizeBytes });
    }
  }

  return results;
}

/** Format listing as a readable string for LLM injection. */
export function formatListing(listing: DirListing): string {
  if (listing.entries.length === 0) return '(empty directory)';
  return listing.entries
    .map((e) => {
      const type = e.type === 'directory' ? '/' : '';
      const size = e.sizeBytes !== undefined ? ` (${e.sizeBytes}B)` : '';
      return `${e.relativePath}${type}${size}`;
    })
    .join('\n');
}
