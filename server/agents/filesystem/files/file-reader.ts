import { readTextFile, getFileStat, fileExists, type FileStat } from '../utils/filesystem-utils.ts';
import { assertReadOperation } from '../validation/file-validator.ts';
import { assertFileSize } from '../validation/integrity-validator.ts';

export interface ReadOptions {
  sandboxRoot: string;
  path: string;
}

export interface ReadLinesOptions extends ReadOptions {
  from: number;
  to: number;
}

export interface FileMetadata extends FileStat {
  path: string;
  lines?: number;
}

export async function readFile(opts: ReadOptions): Promise<string> {
  const absolutePath = await assertReadOperation({
    sandboxRoot: opts.sandboxRoot,
    relativePath: opts.path,
    checkSize: true,
  });
  return readTextFile(absolutePath);
}

export async function readLines(opts: ReadLinesOptions): Promise<string[]> {
  const absolutePath = await assertReadOperation({
    sandboxRoot: opts.sandboxRoot,
    relativePath: opts.path,
    checkSize: true,
  });
  const content = await readTextFile(absolutePath);
  const lines = content.split('\n');

  if (opts.from < 1 || opts.to < opts.from || opts.to > lines.length) {
    throw new RangeError(
      `Line range ${opts.from}-${opts.to} is invalid for file with ${lines.length} lines`,
    );
  }

  return lines.slice(opts.from - 1, opts.to);
}

export async function fileExistsInSandbox(opts: ReadOptions): Promise<boolean> {
  try {
    const absolutePath = await assertReadOperation({
      sandboxRoot: opts.sandboxRoot,
      relativePath: opts.path,
    });
    return fileExists(absolutePath);
  } catch {
    return false;
  }
}

export async function getFileMetadata(opts: ReadOptions): Promise<FileMetadata> {
  const absolutePath = await assertReadOperation({
    sandboxRoot: opts.sandboxRoot,
    relativePath: opts.path,
  });
  await assertFileSize(absolutePath);
  const stat = await getFileStat(absolutePath);
  const content = await readTextFile(absolutePath);
  return {
    ...stat,
    path: opts.path,
    lines: content.split('\n').length,
  };
}

export async function getFileSize(opts: ReadOptions): Promise<number> {
  const absolutePath = await assertReadOperation({
    sandboxRoot: opts.sandboxRoot,
    relativePath: opts.path,
  });
  const stat = await getFileStat(absolutePath);
  return stat.size;
}
