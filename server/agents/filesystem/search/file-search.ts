import { scanFolder } from '../folders/folder-scanner.ts';
import { assertRelativePath } from '../validation/path-validator.ts';
import { basename, extname } from '../utils/path-utils.ts';

export interface FileSearchOptions {
  sandboxRoot: string;
  path: string;
  maxDepth?: number;
}

export interface FileSearchResult {
  name: string;
  relativePath: string;
  size: number;
  extension: string;
}

export async function findByName(
  opts: FileSearchOptions,
  name: string,
): Promise<FileSearchResult[]> {
  assertRelativePath(opts.path);
  const scan = await scanFolder({ ...opts, includeHidden: false });
  return scan.entries
    .filter(e => e.isFile && e.name === name)
    .map(e => ({ name: e.name, relativePath: e.relativePath, size: e.size, extension: e.extension }));
}

export async function findByExtension(
  opts: FileSearchOptions,
  ext: string,
): Promise<FileSearchResult[]> {
  const normalized = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  assertRelativePath(opts.path);
  const scan = await scanFolder({ ...opts, extensions: [normalized] });
  return scan.entries
    .filter(e => e.isFile)
    .map(e => ({ name: e.name, relativePath: e.relativePath, size: e.size, extension: e.extension }));
}

export async function findByPattern(
  opts: FileSearchOptions,
  pattern: RegExp,
): Promise<FileSearchResult[]> {
  assertRelativePath(opts.path);
  const scan = await scanFolder({ ...opts });
  return scan.entries
    .filter(e => e.isFile && pattern.test(e.name))
    .map(e => ({ name: e.name, relativePath: e.relativePath, size: e.size, extension: e.extension }));
}

export async function listFilesInDir(
  sandboxRoot: string,
  dirPath: string,
): Promise<FileSearchResult[]> {
  const scan = await scanFolder({ sandboxRoot, path: dirPath, maxDepth: 1 });
  return scan.entries
    .filter(e => e.isFile && e.depth === 1)
    .map(e => ({ name: e.name, relativePath: e.relativePath, size: e.size, extension: e.extension }));
}
