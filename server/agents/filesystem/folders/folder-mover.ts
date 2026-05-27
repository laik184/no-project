import { promises as fs } from 'node:fs';
import { basename, joinPath } from '../utils/path-utils.ts';
import { assertSandboxPath } from '../validation/sandbox-validator.ts';
import { assertRelativePath } from '../validation/path-validator.ts';
import { permissionManager } from '../permissions/permission-manager.ts';
import { isDirectory, fileExists, ensureDir } from '../utils/filesystem-utils.ts';

export interface MoveFolderOptions {
  sandboxRoot: string;
  sourcePath: string;
  destinationDir: string;
  newName?: string;
}

export interface MoveFolderResult {
  sourcePath: string;
  destinationPath: string;
  sourceAbsolute: string;
  destinationAbsolute: string;
}

export async function moveFolder(opts: MoveFolderOptions): Promise<MoveFolderResult> {
  assertRelativePath(opts.sourcePath);
  assertRelativePath(opts.destinationDir);
  permissionManager.assertMove(opts.sourcePath, opts.destinationDir);

  const sourceAbsolute = assertSandboxPath(opts.sandboxRoot, opts.sourcePath);

  if (!(await isDirectory(sourceAbsolute))) {
    throw new Error(`Source directory not found: "${opts.sourcePath}"`);
  }

  const folderName = opts.newName ?? basename(opts.sourcePath);
  const destinationRelative = joinPath(opts.destinationDir, folderName);
  const destinationAbsolute = assertSandboxPath(opts.sandboxRoot, destinationRelative);

  if (await fileExists(destinationAbsolute)) {
    throw new Error(`Destination already exists: "${destinationRelative}"`);
  }

  await ensureDir(opts.sandboxRoot + '/' + opts.destinationDir);
  await fs.rename(sourceAbsolute, destinationAbsolute);

  return {
    sourcePath: opts.sourcePath,
    destinationPath: destinationRelative,
    sourceAbsolute,
    destinationAbsolute,
  };
}
