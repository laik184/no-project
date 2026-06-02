/**
 * server/file-explorer/services/read.service.ts
 *
 * Service layer for all read operations on the agent sandbox.
 * Tool → ReadService → lib/files/file-reader (repository/infra layer)
 *
 * No tool may import lib/files/file-reader.ts directly.
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
} from '../../tools/filesystem/lib/files/file-reader.ts';

export type { ReadOptions, ReadLinesOptions, FileMetadata };

class ReadService {
  read(opts: ReadOptions): Promise<string> {
    return readFile(opts);
  }

  readLines(opts: ReadLinesOptions): Promise<string[]> {
    return readLines(opts);
  }

  metadata(opts: ReadOptions): Promise<FileMetadata> {
    return getFileMetadata(opts);
  }

  size(opts: ReadOptions): Promise<number> {
    return getFileSize(opts);
  }

  exists(opts: ReadOptions): Promise<boolean> {
    return fileExistsInSandbox(opts);
  }
}

export const readToolService = new ReadService();
