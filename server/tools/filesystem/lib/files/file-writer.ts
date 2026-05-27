import { writeTextFile, fileExists, ensureParentDir } from '../utils/filesystem-utils.ts';
import { assertWriteOperation } from '../validation/file-validator.ts';
import { permissionManager } from '../permissions.ts';

export interface WriteOptions {
  sandboxRoot: string;
  path: string;
  content: string;
  overwrite?: boolean;
}

export interface WriteResult {
  written: boolean;
  path: string;
  absolutePath: string;
  bytes: number;
  skipped?: boolean;
}

export async function writeFile(opts: WriteOptions): Promise<WriteResult> {
  permissionManager.assertWrite(opts.path, opts.content);

  const absolutePath = await assertWriteOperation({
    sandboxRoot: opts.sandboxRoot,
    relativePath: opts.path,
    content: opts.content,
  });

  if (opts.overwrite === false && await fileExists(absolutePath)) {
    return {
      written: false,
      skipped: true,
      path: opts.path,
      absolutePath,
      bytes: 0,
    };
  }

  await writeTextFile(absolutePath, opts.content);

  return {
    written: true,
    path: opts.path,
    absolutePath,
    bytes: Buffer.byteLength(opts.content, 'utf-8'),
  };
}

export async function writeFileIfAbsent(opts: Omit<WriteOptions, 'overwrite'>): Promise<WriteResult> {
  return writeFile({ ...opts, overwrite: false });
}

export async function ensureFile(opts: WriteOptions): Promise<WriteResult> {
  permissionManager.assertWrite(opts.path);

  const absolutePath = await assertWriteOperation({
    sandboxRoot: opts.sandboxRoot,
    relativePath: opts.path,
  });

  if (await fileExists(absolutePath)) {
    return { written: false, skipped: true, path: opts.path, absolutePath, bytes: 0 };
  }

  await writeTextFile(absolutePath, opts.content);
  return {
    written: true,
    path: opts.path,
    absolutePath,
    bytes: Buffer.byteLength(opts.content, 'utf-8'),
  };
}
