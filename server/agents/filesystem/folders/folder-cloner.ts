import { copyDir, isDirectory, fileExists } from '../utils/filesystem-utils.ts';
import { assertSandboxPath } from '../validation/sandbox-validator.ts';
import { assertRelativePath } from '../validation/path-validator.ts';
import { permissionManager } from '../permissions/permission-manager.ts';

export interface CloneFolderOptions {
  sandboxRoot: string;
  sourcePath: string;
  destinationPath: string;
  overwrite?: boolean;
}

export interface CloneFolderResult {
  sourcePath: string;
  destinationPath: string;
  sourceAbsolute: string;
  destinationAbsolute: string;
  overwritten: boolean;
}

export async function cloneFolder(opts: CloneFolderOptions): Promise<CloneFolderResult> {
  assertRelativePath(opts.sourcePath);
  assertRelativePath(opts.destinationPath);
  permissionManager.assertWrite(opts.destinationPath);

  const sourceAbsolute = assertSandboxPath(opts.sandboxRoot, opts.sourcePath);

  if (!(await isDirectory(sourceAbsolute))) {
    throw new Error(`Source directory not found: "${opts.sourcePath}"`);
  }

  const destinationAbsolute = assertSandboxPath(opts.sandboxRoot, opts.destinationPath);
  const alreadyExists = await fileExists(destinationAbsolute);

  if (alreadyExists && !opts.overwrite) {
    throw new Error(
      `Destination already exists: "${opts.destinationPath}" — set overwrite: true to replace`,
    );
  }

  if (alreadyExists && opts.overwrite) {
    const { deleteDir } = await import('../utils/filesystem-utils.ts');
    await deleteDir(destinationAbsolute);
  }

  await copyDir(sourceAbsolute, destinationAbsolute);

  return {
    sourcePath: opts.sourcePath,
    destinationPath: opts.destinationPath,
    sourceAbsolute,
    destinationAbsolute,
    overwritten: alreadyExists && !!opts.overwrite,
  };
}
