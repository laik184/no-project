/**
 * server/file-explorer/services/read/read.service.ts
 * Reads file content with encoding detection, binary guard, and size guard.
 */

import { FE_CONFIG }              from '../../file-explorer/config/index.ts';
import { resolveSafe }            from '../../file-explorer/guards/index.ts';
import { filesystemRepository }   from '../../file-explorer/repositories/index.ts';
import { hasBinaryContent, decodeBuffer } from '../../file-explorer/utils/index.ts';
import type { ReadResponse }      from '../../file-explorer/contracts/index.ts';

class ReadService {

  /**
   * Reads a file and returns its content with metadata.
   * Returns { ok: false } for binary files, missing files, or files exceeding maxReadSizeBytes.
   */
  readFile(filePath: string): ReadResponse {
    try {
      const abs  = resolveSafe(filePath);
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
