/**
 * server/services/filesystem/read/tool.service.ts
 *
 * Tool-facing service for agent sandbox read operations.
 * Tool → readToolService → lib/files/file-reader (infra layer)
 */

import {
  readFile,
  readLines,
  getFileMetadata,
  getFileSize,
  fileExistsInSandbox,
  type ReadOptions,
  type ReadLinesOptions,
  type FileMetadata,
} from '../../../tools/filesystem/lib/files/file-reader.ts';

export type { ReadOptions, ReadLinesOptions, FileMetadata };

class ReadToolService {
  read(opts: ReadOptions): Promise<string>          { return readFile(opts); }
  readLines(opts: ReadLinesOptions): Promise<string[]> { return readLines(opts); }
  metadata(opts: ReadOptions): Promise<FileMetadata>{ return getFileMetadata(opts); }
  size(opts: ReadOptions): Promise<number>          { return getFileSize(opts); }
  exists(opts: ReadOptions): Promise<boolean>       { return fileExistsInSandbox(opts); }
}

export const readToolService = new ReadToolService();
