/**
 * server/file-explorer/services/read/read.service.ts
 * Reads file content with encoding detection, binary guard, and size guard.
 *
 * readFile() accepts an optional sandboxRoot so that agent tools can pass the
 * per-execution context root instead of the global FE_CONFIG root.
 */

import { FE_CONFIG }              from '../../../shared/file-explorer-core/config/index.ts';
import { resolveSafe }            from '../../../shared/file-explorer-core/guards/index.ts';
import { filesystemRepository }   from '../../../repositories/file-system/index.ts';
import { hasBinaryContent, decodeBuffer } from '../../../shared/file-explorer-core/utils/index.ts';
import type { ReadResponse }      from '../../../shared/file-explorer-core/contracts/index.ts';

class ReadService {

  /**
   * Reads a file and returns its content with metadata.
   * Returns { ok: false } for binary files, missing files, or files exceeding maxReadSizeBytes.
   *
   * @param sandboxRoot  Per-execution sandbox root. Defaults to FE_CONFIG.sandboxRoot.
   *                     Agent tools must pass ctx.sandboxRoot here for per-project isolation.
   */
  readFile(filePath: string, sandboxRoot?: string): ReadResponse {
    try {
      const root = sandboxRoot ?? FE_CONFIG.sandboxRoot;
      const abs  = resolveSafe(filePath, root);
      const stat = filesystemRepository.stat(abs);

      if (!stat.exists) {
        return { ok: false, error: 'File not found' };
      }
      if (stat.isDir) {
        return { ok: false, error: 'Cannot read a directory' };
      }
      if (stat.size > FE_CONFIG.maxReadSizeBytes) {
        return { ok: false, error: `File too large (${stat.size} bytes). Limit: ${FE_CONFIG.maxReadSizeBytes} bytes` };
      }

      const buf = filesystemRepository.readBuffer(abs);

      if (hasBinaryContent(buf)) {
        return { ok: false, error: 'Binary file — cannot display in editor' };
      }

      const { content, encoding } = decodeBuffer(buf);

      return {
        ok:          true,
        content,
        serverMtime: stat.mtime,
        modifiedAt:  new Date(stat.mtime).toISOString(),
        encoding,
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const readService = new ReadService();
