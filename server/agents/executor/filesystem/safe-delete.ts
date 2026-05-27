/**
 * safe-delete.ts
 * Fail-closed file deletion with sandbox boundary checks.
 */

import fs   from 'fs/promises';
import path from 'path';
import { pathManager }      from './path-manager.ts';
import { validateFilePath } from '../validation/file-integrity.ts';

const PROTECTED_FILES = new Set([
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  '.gitignore',
  'README.md',
]);

export interface DeleteResult {
  ok:    boolean;
  error?: string;
}

/** Safely delete a file from the sandbox. Rejects protected files and directories. */
export async function safeDelete(
  projectId:    string,
  relativePath: string,
): Promise<DeleteResult> {
  const pathCheck = validateFilePath(relativePath);
  if (!pathCheck.valid) {
    return { ok: false, error: `Invalid path: ${pathCheck.reason}` };
  }

  const fileName = path.basename(relativePath);
  if (PROTECTED_FILES.has(fileName)) {
    return { ok: false, error: `Protected file cannot be deleted: ${fileName}` };
  }

  const abs = pathManager.resolve(projectId, relativePath);

  let stat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stat = await fs.stat(abs);
  } catch {
    return { ok: false, error: `File not found: ${relativePath}` };
  }

  if (stat.isDirectory()) {
    return { ok: false, error: `Cannot delete directory with this tool: ${relativePath}` };
  }

  try {
    await fs.unlink(abs);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Delete failed: ${(e as Error).message}` };
  }
}
