/**
 * server/file-explorer/services/upload/upload.service.ts
 * Handles multipart file upload, preserving relative paths from originalname.
 */

import { resolveSafe }          from '../../guards/index.ts';
import { filesystemRepository } from '../../repositories/index.ts';
import { toUploadedFile }       from '../../mappers/index.ts';
import type { UploadResponse }  from '../../contracts/index.ts';

class UploadService {

  /**
   * Saves each multer file to the sandbox at the path given by file.originalname.
   * Uses originalname to preserve directory structure (folder drag-drop).
   * Returns uploaded[] and failed[] arrays.
   */
  upload(files: Express.Multer.File[]): UploadResponse {
    const uploaded = [];
    const failed: string[] = [];

    for (const f of files) {
      try {
        const abs = resolveSafe(f.originalname);
        filesystemRepository.writeBuffer(abs, f.buffer);
        uploaded.push(toUploadedFile(f, abs));
      } catch (err) {
        console.error(`[upload] Failed to save ${f.originalname}:`, err);
        failed.push(f.originalname);
      }
    }

    return { ok: failed.length === 0, uploaded, failed };
  }
}

export const uploadService = new UploadService();
