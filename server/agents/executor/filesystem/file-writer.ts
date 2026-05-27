import fs from 'fs/promises';
import path from 'path';
import { pathManager } from './path-manager.ts';
import { validateFilePath, validateFileContent } from '../validation/file-integrity.ts';
import { permissionManager } from '../sandbox/permission-manager.ts';

export const fileWriter = {
  /** Write content to a sandbox file, creating parent dirs as needed. */
  async write(projectId: string, relativePath: string, content: string): Promise<string> {
    const pathCheck = validateFilePath(relativePath);
    if (!pathCheck.valid) throw new Error(`Invalid path: ${pathCheck.reason}`);

    const contentCheck = validateFileContent(content);
    if (!contentCheck.valid) throw new Error(`Invalid content: ${contentCheck.reason}`);

    permissionManager.assertWrite(relativePath);

    const abs = pathManager.resolve(projectId, relativePath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, 'utf8');
    return abs;
  },

  /** Write a file only if it does not already exist. */
  async writeIfAbsent(
    projectId: string,
    relativePath: string,
    content: string,
  ): Promise<boolean> {
    try {
      const abs = pathManager.resolve(projectId, relativePath);
      await fs.access(abs);
      return false; // already exists
    } catch {
      await fileWriter.write(projectId, relativePath, content);
      return true;
    }
  },

  /** Ensure a directory exists inside the sandbox. */
  async ensureDir(projectId: string, relativePath: string): Promise<string> {
    const check = validateFilePath(relativePath);
    if (!check.valid) throw new Error(`Invalid path: ${check.reason}`);

    const abs = pathManager.resolve(projectId, relativePath);
    await fs.mkdir(abs, { recursive: true });
    return abs;
  },

  /** Delete a file from the sandbox. */
  async remove(projectId: string, relativePath: string): Promise<void> {
    permissionManager.assertWrite(relativePath);
    const abs = pathManager.resolve(projectId, relativePath);
    await fs.unlink(abs).catch(() => undefined);
  },
};
