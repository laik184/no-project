import { promises as fs } from 'node:fs';
import { basename, joinPath } from '../utils/path-utils.ts';
import { assertSandboxPath } from '../validation/sandbox-validator.ts';
import { assertRelativePath } from '../validation/path-validator.ts';
import { permissionManager } from '../permissions/permission-manager.ts';
import { fileExists, isFile, ensureParentDir } from '../utils/filesystem-utils.ts';

export interface MoveOptions {
  sandboxRoot: string;
  sourcePath: string;
  destinationDir: string;
  newName?: string;
}

export interface MoveResult {
  sourcePath: string;
  destinationPath: string;
  sourceAbsolute: string;
  destinationAbsolute: string;
}

export async function moveFile(opts: MoveOptions): Promise<MoveResult> {
  assertRelativePath(opts.sourcePath);
  assertRelativePath(opts.destinationDir);
  permissionManager.assertMove(opts.sourcePath, opts.destinationDir);

  const sourceAbsolute = assertSandboxPath(opts.sandboxRoot, opts.sourcePath);

  if (!(await fileExists(sourceAbsolute))) {
    throw new Error(`Source file not found: "${opts.sourcePath}"`);
  }

  if (!(await isFile(sourceAbsolute))) {
    throw new Error(`Source path is not a file: "${opts.sourcePath}"`);
  }

  const fileName = opts.newName ?? basename(opts.sourcePath);
  const destinationRelative = joinPath(opts.destinationDir, fileName);
  const destinationAbsolute = assertSandboxPath(opts.sandboxRoot, destinationRelative);

  if (await fileExists(destinationAbsolute)) {
    throw new Error(`Destination already exists: "${destinationRelative}"`);
  }

  await ensureParentDir(destinationAbsolute);
  await fs.rename(sourceAbsolute, destinationAbsolute);

  return {
    sourcePath: opts.sourcePath,
    destinationPath: destinationRelative,
    sourceAbsolute,
    destinationAbsolute,
  };
}
