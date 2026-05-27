import { deleteFile, fileExists, isFile } from '../utils/filesystem-utils.ts';
import { assertSandboxPath } from '../validation/sandbox-validator.ts';
import { assertRelativePath } from '../validation/path-validator.ts';
import { permissionManager } from '../permissions/permission-manager.ts';

export interface DeleteOptions {
  sandboxRoot: string;
  path: string;
  mustExist?: boolean;
}

export interface DeleteResult {
  deleted: boolean;
  path: string;
  absolutePath: string;
  skipped?: boolean;
}

export async function deleteFileFromSandbox(opts: DeleteOptions): Promise<DeleteResult> {
  assertRelativePath(opts.path);
  permissionManager.assertDelete(opts.path);

  const absolutePath = assertSandboxPath(opts.sandboxRoot, opts.path);

  if (!(await fileExists(absolutePath))) {
    if (opts.mustExist) {
      throw new Error(`File not found: "${opts.path}"`);
    }
    return { deleted: false, skipped: true, path: opts.path, absolutePath };
  }

  if (!(await isFile(absolutePath))) {
    throw new Error(`Path is not a file: "${opts.path}" — use folder-deleter for directories`);
  }

  await deleteFile(absolutePath);
  return { deleted: true, path: opts.path, absolutePath };
}

export async function deleteMultipleFiles(
  sandboxRoot: string,
  paths: string[],
): Promise<DeleteResult[]> {
  return Promise.all(paths.map(path => deleteFileFromSandbox({ sandboxRoot, path })));
}
