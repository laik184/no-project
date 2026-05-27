import { deleteDir, isDirectory, fileExists } from '../utils/filesystem-utils.ts';
import { assertSandboxPath } from '../validation/sandbox-validator.ts';
import { assertRelativePath } from '../validation/path-validator.ts';
import { permissionManager, guardDelete } from '../permissions.ts';

export interface DeleteFolderOptions {
  sandboxRoot: string;
  path: string;
  mustExist?: boolean;
  force?: boolean;
}

export interface DeleteFolderResult {
  deleted: boolean;
  path: string;
  absolutePath: string;
  skipped?: boolean;
}

export async function deleteFolder(opts: DeleteFolderOptions): Promise<DeleteFolderResult> {
  assertRelativePath(opts.path);
  permissionManager.assertDelete(opts.path);
  guardDelete(opts.path);

  const absolutePath = assertSandboxPath(opts.sandboxRoot, opts.path);

  if (!(await fileExists(absolutePath))) {
    if (opts.mustExist) {
      throw new Error(`Directory not found: "${opts.path}"`);
    }
    return { deleted: false, skipped: true, path: opts.path, absolutePath };
  }

  if (!(await isDirectory(absolutePath))) {
    throw new Error(`Path is not a directory: "${opts.path}" — use file-deleter for files`);
  }

  await deleteDir(absolutePath);
  return { deleted: true, path: opts.path, absolutePath };
}
