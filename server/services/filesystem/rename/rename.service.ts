/**
 * server/file-explorer/services/rename/rename.service.ts
 * Renames or moves a file or folder.
 */

import { resolveSafe }           from '../../../shared/file-explorer-core/guards/index.ts';
import { filesystemRepository }  from '../../../repositories/file-system/index.ts';
import { metadataRepository }    from '../../../repositories/file-system/index.ts';
import type { RenameResponse }   from '../../../shared/file-explorer-core/contracts/index.ts';

class RenameService {

  /**
   * Renames or moves oldPath to newPath.
   * Destination parent directory is auto-created if absent.
   */
  rename(oldPath: string, newPath: string): RenameResponse {
    try {
      const absOld = resolveSafe(oldPath);
      const absNew = resolveSafe(newPath);

      if (!filesystemRepository.exists(absOld)) {
        return { ok: false, error: `Source not found: ${oldPath}` };
      }
      if (filesystemRepository.exists(absNew)) {
        return { ok: false, error: `Destination already exists: ${newPath}` };
      }

      filesystemRepository.rename(absOld, absNew);
      metadataRepository.invalidate(absOld);
      metadataRepository.invalidate(absNew);

      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const renameService = new RenameService();
