/**
 * server/file-explorer/mappers/file.mapper.ts
 * Maps raw file content and stat into typed response contracts.
 */

import type { FileContent } from '../types/index.ts';
import type { ReadResponse } from '../contracts/index.ts';
import type { UploadedFile } from '../contracts/index.ts';

/** Maps a FileContent domain object to a ReadResponse. */
export function toReadResponse(content: FileContent): ReadResponse {
  return {
    ok:          true,
    content:     content.content,
    serverMtime: content.serverMtime,
    modifiedAt:  content.modifiedAt,
    encoding:    content.encoding,
  };
}

/** Maps a multer file + saved path to an UploadedFile contract. */
export function toUploadedFile(
  original: Express.Multer.File,
  savedPath: string,
): UploadedFile {
  return {
    originalName: original.originalname,
    savedPath,
    size:         original.size,
  };
}
