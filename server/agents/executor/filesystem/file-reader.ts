import fs from 'fs/promises';
import { pathManager } from './path-manager.ts';
import { validateFilePath } from '../validation/file-integrity.ts';

export const fileReader = {
  /** Read the full text content of a sandbox file. */
  async read(projectId: string, relativePath: string): Promise<string> {
    const check = validateFilePath(relativePath);
    if (!check.valid) throw new Error(`Invalid path: ${check.reason}`);

    const abs = pathManager.resolve(projectId, relativePath);
    return fs.readFile(abs, 'utf8');
  },

  /** Read lines from a file, optionally sliced. */
  async readLines(
    projectId: string,
    relativePath: string,
    start = 0,
    end?: number,
  ): Promise<string[]> {
    const content = await fileReader.read(projectId, relativePath);
    const lines = content.split('\n');
    return end !== undefined ? lines.slice(start, end) : lines.slice(start);
  },

  /** Return true if the file exists in the sandbox. */
  async exists(projectId: string, relativePath: string): Promise<boolean> {
    try {
      const abs = pathManager.resolve(projectId, relativePath);
      await fs.access(abs);
      return true;
    } catch {
      return false;
    }
  },

  /** Get the byte size of a file. Returns null if not found. */
  async getSize(projectId: string, relativePath: string): Promise<number | null> {
    try {
      const abs  = pathManager.resolve(projectId, relativePath);
      const stat = await fs.stat(abs);
      return stat.size;
    } catch {
      return null;
    }
  },
};
