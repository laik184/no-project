import { ensureDir, fileExists, isDirectory } from '../utils/filesystem-utils.ts';
import { assertSandboxPath } from '../validation/sandbox-validator.ts';
import { assertRelativePath } from '../validation/path-validator.ts';
import { permissionManager } from '../permissions.ts';

export interface CreateFolderOptions {
  sandboxRoot: string;
  path: string;
  recursive?: boolean;
}

export interface CreateFolderResult {
  path: string;
  absolutePath: string;
  created: boolean;
  alreadyExisted: boolean;
}

export async function createFolder(opts: CreateFolderOptions): Promise<CreateFolderResult> {
  assertRelativePath(opts.path);
  permissionManager.assertWrite(opts.path);

  const absolutePath = assertSandboxPath(opts.sandboxRoot, opts.path);
  const alreadyExisted = await isDirectory(absolutePath);

  if (alreadyExisted) {
    return { path: opts.path, absolutePath, created: false, alreadyExisted: true };
  }

  if (opts.recursive === false) {
    const { dirname } = await import('../utils/path-utils.ts');
    const parent = dirname(absolutePath);
    if (!(await isDirectory(parent))) {
      throw new Error(`Parent directory does not exist: use recursive: true to create nested dirs`);
    }
  }

  await ensureDir(absolutePath);
  return { path: opts.path, absolutePath, created: true, alreadyExisted: false };
}

export async function createFolders(
  sandboxRoot: string,
  paths: string[],
): Promise<CreateFolderResult[]> {
  return Promise.all(paths.map(path => createFolder({ sandboxRoot, path, recursive: true })));
}
