/**
 * server/file-explorer/services/metadata/metadata.service.ts
 * Returns rich metadata for a single file (language, encoding, line count, etc.).
 */

import { resolveSafe }            from '../../file-explorer/guards/index.ts';
import { filesystemRepository }   from '../../file-explorer/repositories/index.ts';
import { metadataRepository }     from '../../file-explorer/repositories/index.ts';
import { decodeBuffer, countLines, hasBinaryContent } from '../../file-explorer/utils/index.ts';
import { getExtension, guessLanguage }                from '../../file-explorer/utils/index.ts';
import { toRelative }             from '../../file-explorer/utils/index.ts';
import { FE_CONFIG }              from '../../file-explorer/config/index.ts';
import type { MetadataResponse }  from '../../file-explorer/contracts/index.ts';

class MetadataService {

  /** Returns rich metadata for a file. Caches stat; recomputes lineCount each call. */
  getMeta(filePath: string): MetadataResponse {
    try {
      const abs  = resolveSafe(filePath);
      const stat = filesystemRepository.stat(abs);
      if (!stat.exists) return { ok: false, error: 'Not found' };
      if (stat.isDir)   return { ok: false, error: 'Path is a directory' };

      metadataRepository.set(abs, stat);

      const buf      = filesystemRepository.readBuffer(abs);
      const binary   = hasBinaryContent(buf);
      const encoding = binary ? 'binary' : decodeBuffer(buf).encoding;
      const content  = binary ? '' : decodeBuffer(buf).content;
      const ext      = getExtension(filePath.split('/').pop() ?? '');

      return {
        ok:   true,
        meta: {
          path:      toRelative(abs, FE_CONFIG.sandboxRoot),
          size:      stat.size,
          mtime:     stat.mtime,
          encoding,
          lineCount: binary ? 0 : countLines(content),
          extension: ext,
          isBinary:  binary,
          language:  guessLanguage(filePath),
        },
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const metadataService = new MetadataService();
