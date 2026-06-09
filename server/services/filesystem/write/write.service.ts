/**
 * server/file-explorer/services/write/write.service.ts
 * Writes file content with optional clientMtime conflict detection.
 *
 * saveFile() accepts an optional sandboxRoot parameter so that agent tools
 * can pass the per-execution context root instead of the global FE_CONFIG root.
 * The file-explorer UI omits sandboxRoot and gets the global default.
 */

import path                     from 'path';
import { resolveSafe }          from '../../../shared/file-explorer-core/guards/index.ts';
import { FE_CONFIG }            from '../../../shared/file-explorer-core/config/index.ts';
import { filesystemRepository } from '../../../repositories/file-system/index.ts';
import { metadataRepository }   from '../../../repositories/file-system/index.ts';
import type { WriteResponse }   from '../../../shared/file-explorer-core/contracts/index.ts';

class WriteService {

  /**
   * Saves file content to disk.
   * If clientMtime is provided and diverges > 1 second from server mtime, returns conflict=true.
   * Invalidates the metadata cache on success.
   *
   * @param sandboxRoot  Per-execution sandbox root. Defaults to FE_CONFIG.sandboxRoot.
   *                     Agent tools must pass ctx.sandboxRoot here for per-project isolation.
   */
  saveFile(filePath: string, content: string, clientMtime?: number, sandboxRoot?: string): WriteResponse {
    try {
      const root = sandboxRoot ?? FE_CONFIG.sandboxRoot;
      const abs  = resolveSafe(filePath, root);
      const stat = filesystemRepository.stat(abs);

      if (stat.exists && !stat.isDir && clientMtime !== undefined) {
        const drift = Math.abs(stat.mtime - clientMtime);
        if (drift > 1000) {
          return { ok: false, conflict: true, serverMtime: stat.mtime, error: 'Conflict: file was modified by another writer' };
        }
      }

      const relPath = path.relative(root, abs).split(path.sep).join('/');
      filesystemRepository.writeText(abs, content, { projectId: 1, relPath });
      metadataRepository.invalidate(abs);
      const newStat = filesystemRepository.stat(abs);

      return { ok: true, serverMtime: newStat.mtime };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const writeService = new WriteService();
