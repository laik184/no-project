/**
 * server/file-explorer/services/create/create.service.ts
 * Creates a new file or folder in the sandbox.
 *
 * createEntry() accepts an optional sandboxRoot so that agent tools can pass the
 * per-execution context root instead of the global FE_CONFIG root.
 */

import { resolveSafe }          from '../../../shared/file-explorer-core/guards/index.ts';
import { filesystemRepository } from '../../../repositories/file-system/index.ts';
import { FE_CONFIG }            from '../../../shared/file-explorer-core/config/index.ts';
import { toRelative }           from '../../../shared/file-explorer-core/utils/index.ts';
import type { CreateResponse }  from '../../../shared/file-explorer-core/contracts/index.ts';

class CreateService {

  /**
   * Creates a file (default) or folder at the given relative path.
   * Returns the relative path of the created entry.
   *
   * @param sandboxRoot  Per-execution sandbox root. Defaults to FE_CONFIG.sandboxRoot.
   *                     Agent tools must pass ctx.sandboxRoot here for per-project isolation.
   */
  createEntry(filePath: string, isFolder = false, content = '', sandboxRoot?: string, projectId = 1): CreateResponse {
    try {
      const root = sandboxRoot ?? FE_CONFIG.sandboxRoot;
      const abs  = resolveSafe(filePath, root);

      if (filesystemRepository.exists(abs)) {
        return { ok: false, error: `Already exists: ${filePath}` };
      }

      if (isFolder) {
        filesystemRepository.mkdir(abs, { projectId, relPath: toRelative(abs, root) });
      } else {
        filesystemRepository.writeText(abs, content, { projectId, relPath: toRelative(abs, root) });
      }

      return { ok: true, path: toRelative(abs, root) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const createService = new CreateService();
