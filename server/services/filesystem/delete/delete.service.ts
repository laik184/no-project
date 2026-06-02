/**
 * server/file-explorer/services/delete/delete.service.ts
 * Deletes a file or folder (recursive).
 */

import { resolveSafe }          from '../../file-explorer/guards/index.ts';
import { filesystemRepository } from '../../file-explorer/repositories/index.ts';
import { metadataRepository }   from '../../file-explorer/repositories/index.ts';
import type { DeleteResponse }  from '../../file-explorer/contracts/index.ts';

class DeleteService {

  /**
   * Deletes the file or folder at targetPath.
   * Folder deletions are recursive.
   */
  delete(targetPath: string): DeleteResponse {
    try {
      const abs = resolveSafe(targetPath);

      if (!filesystemRepository.exists(abs)) {
        return { ok: false, error: `Not found: ${targetPath}` };
      }

      filesystemRepository.remove(abs);
      metadataRepository.invalidate(abs);

      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const deleteService = new DeleteService();
