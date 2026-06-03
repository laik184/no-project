/**
 * server/file-explorer/services/delete/delete.service.ts
 * Deletes a file or folder (recursive).
 */

import { resolveSafe }          from '../../../shared/file-explorer-core/guards/index.ts';
import { filesystemRepository } from '../../../repositories/file-system/index.ts';
import { metadataRepository }   from '../../../repositories/file-system/index.ts';
import type { DeleteResponse }  from '../../../shared/file-explorer-core/contracts/index.ts';

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
