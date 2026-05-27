import fs from 'fs/promises';
import path from 'path';
import { pathManager } from './path-manager.ts';
import { validateFilePath } from '../validation/file-integrity.ts';

export interface FileMatch {
  relativePath: string;
  lineNumber:   number;
  lineContent:  string;
}

export const fileSearch = {
  /** List all files in a sandbox directory (non-recursive by default). */
  async listDir(
    projectId: string,
    relativePath: string,
    recursive = false,
  ): Promise<string[]> {
    const check = validateFilePath(relativePath);
    if (!check.valid) throw new Error(`Invalid path: ${check.reason}`);

    const abs = pathManager.resolve(projectId, relativePath);
    return recursive
      ? listRecursive(abs, pathManager.root(projectId))
      : listFlat(abs, relativePath);
  },

  /** Find files by extension within the sandbox. */
  async findByExtension(
    projectId: string,
    ext: string,
    baseDir = '.',
  ): Promise<string[]> {
    const all = await fileSearch.listDir(projectId, baseDir, true);
    return all.filter((f) => f.endsWith(ext));
  },

  /** Search for a string in all text files under a sandbox dir. */
  async grep(
    projectId: string,
    searchText: string,
    baseDir = '.',
  ): Promise<FileMatch[]> {
    const files   = await fileSearch.listDir(projectId, baseDir, true);
    const matches: FileMatch[] = [];

    for (const relativePath of files) {
      try {
        const abs     = pathManager.resolve(projectId, relativePath);
        const content = await fs.readFile(abs, 'utf8');
        content.split('\n').forEach((line, idx) => {
          if (line.includes(searchText)) {
            matches.push({ relativePath, lineNumber: idx + 1, lineContent: line.trim() });
          }
        });
      } catch { /* skip unreadable files */ }
    }

    return matches;
  },
};

async function listFlat(absDir: string, base: string): Promise<string[]> {
  const entries = await fs.readdir(absDir).catch(() => [] as string[]);
  return entries.map((e) => path.join(base, e));
}

async function listRecursive(absDir: string, sandboxRoot: string): Promise<string[]> {
  const results: string[] = [];
  const visit = async (dir: string): Promise<void> => {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await visit(full);
      } else {
        results.push(path.relative(sandboxRoot, full));
      }
    }
  };
  await visit(absDir);
  return results;
}
