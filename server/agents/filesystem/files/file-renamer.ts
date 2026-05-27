import { promises as fs } from 'node:fs';
import { joinPath, dirname, basename } from '../utils/path-utils.ts';
import { assertSandboxPath } from '../validation/sandbox-validator.ts';
import { assertFilename } from '../validation/path-validator.ts';
import { permissionManager } from '../permissions/permission-manager.ts';
import { fileExists, isFile } from '../utils/filesystem-utils.ts';

export interface RenameOptions {
  sandboxRoot: string;
  path: string;
  newName: string;
}

export interface RenameResult {
  oldPath: string;
  newPath: string;
  oldAbsolute: string;
  newAbsolute: string;
}

export async function renameFile(opts: RenameOptions): Promise<RenameResult> {
  assertFilename(opts.newName);
  permissionManager.assertRename(opts.path, opts.newName);

  const oldAbsolute = assertSandboxPath(opts.sandboxRoot, opts.path);

  if (!(await fileExists(oldAbsolute))) {
    throw new Error(`File not found: "${opts.path}"`);
  }

  if (!(await isFile(oldAbsolute))) {
    throw new Error(`Path is not a file: "${opts.path}"`);
  }

  const parentRelative = dirname(opts.path);
  const newRelative = parentRelative === '.' ? opts.newName : joinPath(parentRelative, opts.newName);
  const newAbsolute = assertSandboxPath(opts.sandboxRoot, newRelative);

  if (await fileExists(newAbsolute)) {
    throw new Error(`A file named "${opts.newName}" already exists in "${parentRelative}"`);
  }

  await fs.rename(oldAbsolute, newAbsolute);

  return {
    oldPath: opts.path,
    newPath: newRelative,
    oldAbsolute,
    newAbsolute,
  };
}
