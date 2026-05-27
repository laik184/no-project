import { copyFile, fileExists, isFile } from '../utils/filesystem-utils.ts';
import { assertSandboxPath } from '../validation/sandbox-validator.ts';
import { assertRelativePath } from '../validation/path-validator.ts';
import { permissionManager } from '../permissions/permission-manager.ts';

export interface CloneOptions {
  sandboxRoot: string;
  sourcePath: string;
  destinationPath: string;
  overwrite?: boolean;
}

export interface CloneResult {
  sourcePath: string;
  destinationPath: string;
  sourceAbsolute: string;
  destinationAbsolute: string;
  overwritten: boolean;
}

export async function cloneFile(opts: CloneOptions): Promise<CloneResult> {
  assertRelativePath(opts.sourcePath);
  assertRelativePath(opts.destinationPath);
  permissionManager.assertWrite(opts.destinationPath);

  const sourceAbsolute = assertSandboxPath(opts.sandboxRoot, opts.sourcePath);

  if (!(await fileExists(sourceAbsolute))) {
    throw new Error(`Source file not found: "${opts.sourcePath}"`);
  }

  if (!(await isFile(sourceAbsolute))) {
    throw new Error(`Source is not a file: "${opts.sourcePath}"`);
  }

  const destinationAbsolute = assertSandboxPath(opts.sandboxRoot, opts.destinationPath);
  const alreadyExists = await fileExists(destinationAbsolute);

  if (alreadyExists && !opts.overwrite) {
    throw new Error(
      `Destination already exists: "${opts.destinationPath}" — set overwrite: true to replace`,
    );
  }

  await copyFile(sourceAbsolute, destinationAbsolute);

  return {
    sourcePath: opts.sourcePath,
    destinationPath: opts.destinationPath,
    sourceAbsolute,
    destinationAbsolute,
    overwritten: alreadyExists && !!opts.overwrite,
  };
}
