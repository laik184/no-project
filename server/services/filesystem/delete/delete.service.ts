/**
 * server/file-explorer/services/delete/delete.service.ts
 * Deletes a file or folder (recursive).
 */

import { resolveSafe }          from '../../../shared/file-explorer-core/guards/index.ts';
import { FE_CONFIG }            from '../../../shared/file-explorer-core/config/index.ts';
import { toRelative }           from '../../../shared/file-explorer-core/utils/index.ts';
import { filesystemRepository } from '../../../repositories/file-system/index.ts';
import { metadataRepository }   from '../../../repositories/file-system/index.ts';
import type { DeleteResponse }  from '../../../shared/file-explorer-core/contracts/index.ts';

class DeleteService {

  /**
   * Deletes the file or folder at targetPath (recursive for folders).
   * @param sandboxRoot  Per-execution sandbox root. Defaults to FE_CONFIG.sandboxRoot.
   *                     Agent tools must pass ctx.sandboxRoot for per-project isolation.
   */
  delete(targetPath: string, sandboxRoot?: string, projectId = 1): DeleteResponse {
    try {
      const root = sandboxRoot ?? FE_CONFIG.sandboxRoot;
      const abs  = resolveSafe(targetPath, root);

      if (!filesystemRepository.exists(abs)) {
        return { ok: false, error: `Not found: ${targetPath}` };
      }

      filesystemRepository.remove(abs, { projectId, relPath: toRelative(abs, root) });
      metadataRepository.invalidate(abs);

      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const deleteService = new DeleteService();
