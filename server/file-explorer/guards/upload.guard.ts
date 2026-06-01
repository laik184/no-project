/**
 * server/file-explorer/guards/upload.guard.ts
 * Guards for multipart file upload requests.
 */

import { FE_CONFIG } from '../config/index.ts';

const MAX_BYTES = FE_CONFIG.maxUploadSizeMb * 1024 * 1024;

/** Throws if no files are present in the upload. */
export function assertHasFiles(files: Express.Multer.File[] | undefined): asserts files is Express.Multer.File[] {
  if (!files || files.length === 0) {
    throw new Error('No files provided in upload');
  }
}

/** Throws if any single file exceeds the configured size limit. */
export function assertFileSizes(files: Express.Multer.File[]): void {
  for (const f of files) {
    if (f.size > MAX_BYTES) {
      throw new Error(
        `File "${f.originalname}" exceeds max size (${f.size} bytes, limit ${MAX_BYTES} bytes)`,
      );
    }
  }
}
