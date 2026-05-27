import { promises as fs } from 'node:fs';
import { joinPath, dirname } from '../utils/path-utils.ts';
import { assertSandboxPath } from '../validation/sandbox-validator.ts';
import { assertFilename, assertRelativePath } from '../validation/path-validator.ts';
import { permissionManager } from '../permissions.ts';
import { isDirectory, fileExists } from '../utils/filesystem-utils.ts';

export interface RenameFolderOptions {
  sandboxRoot: string;
  path: string;
  newName: string;
}

export interface RenameFolderResult {
  oldPath: string;
  newPath: string;
  oldAbsolute: string;
  newAbsolute: string;
}

export async function renameFolder(opts: RenameFolderOptions): Promise<RenameFolderResult> {
  assertRelativePath(opts.path);
  assertFilename(opts.newName);
  permissionManager.assertRename(opts.path, opts.newName);

  const oldAbsolute = assertSandboxPath(opts.sandboxRoot, opts.path);

  if (!(await isDirectory(oldAbsolute))) {
    throw new Error(`Directory not found: "${opts.path}"`);
  }

  const parentRelative = dirname(opts.path);
  const newRelative = parentRelative === '.' ? opts.newName : joinPath(parentRelative, opts.newName);
  const newAbsolute = assertSandboxPath(opts.sandboxRoot, newRelative);

  if (await fileExists(newAbsolute)) {
    throw new Error(`A file or folder named "${opts.newName}" already exists`);
  }

  await fs.rename(oldAbsolute, newAbsolute);

  return {
    oldPath: opts.path,
    newPath: newRelative,
    oldAbsolute,
    newAbsolute,
  };
}
