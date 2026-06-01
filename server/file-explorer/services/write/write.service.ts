/**
 * server/file-explorer/services/write/write.service.ts
 * Writes file content with optional clientMtime conflict detection.
 */

import { resolveSafe }          from '../../guards/index.ts';
import { filesystemRepository } from '../../repositories/index.ts';
import { metadataRepository }   from '../../repositories/index.ts';
import type { WriteResponse }   from '../../contracts/index.ts';

class WriteService {

  /**
   * Saves file content to disk.
   * If clientMtime is provided and diverges > 1 second from server mtime, returns conflict=true.
   * Invalidates the metadata cache on success.
   */
  saveFile(filePath: string, content: string, clientMtime?: number): WriteResponse {
    try {
      const abs  = resolveSafe(filePath);
      const stat = filesystemRepository.stat(abs);

      if (stat.exists && !stat.isDir && clientMtime !== undefined) {
        const drift = Math.abs(stat.mtime - clientMtime);
        if (drift > 1000) {
          return { ok: false, conflict: true, serverMtime: stat.mtime, error: 'Conflict: file was modified by another writer' };
        }
      }

      filesystemRepository.writeText(abs, content);
      metadataRepository.invalidate(abs);
      const newStat = filesystemRepository.stat(abs);

      return { ok: true, serverMtime: newStat.mtime };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const writeService = new WriteService();
