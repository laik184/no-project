/**
 * server/file-explorer/services/create/create.service.ts
 * Creates a new file or folder in the sandbox.
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
   */
  createEntry(filePath: string, isFolder = false, content = ''): CreateResponse {
    try {
      const abs = resolveSafe(filePath);

      if (filesystemRepository.exists(abs)) {
        return { ok: false, error: `Already exists: ${filePath}` };
      }

      if (isFolder) {
        filesystemRepository.mkdir(abs);
      } else {
        filesystemRepository.writeText(abs, content);
      }

      return { ok: true, path: toRelative(abs, FE_CONFIG.sandboxRoot) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const createService = new CreateService();
