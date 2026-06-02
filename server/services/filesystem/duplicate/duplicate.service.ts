/**
 * server/file-explorer/services/duplicate/duplicate.service.ts
 * Copies a file or folder to a new destination.
 */

import path from 'path';
import { resolveSafe }              from '../../file-explorer/guards/index.ts';
import { filesystemRepository }     from '../../file-explorer/repositories/index.ts';
import { metadataRepository }       from '../../file-explorer/repositories/index.ts';
import { duplicateName, toRelative } from '../../file-explorer/utils/index.ts';
import { FE_CONFIG }                from '../../file-explorer/config/index.ts';
import type { DuplicateResponse }   from '../../file-explorer/contracts/index.ts';

class DuplicateService {

  /**
   * Copies sourcePath to destPath.
   * If destPath is omitted, auto-generates a unique sibling name ("foo copy.ts").
   */
  duplicate(sourcePath: string, destPath?: string): DuplicateResponse {
    try {
      const absSrc = resolveSafe(sourcePath);

      if (!filesystemRepository.exists(absSrc)) {
        return { ok: false, error: `Source not found: ${sourcePath}` };
      }

      let absDest: string;
      if (destPath) {
        absDest = resolveSafe(destPath);
      } else {
        const siblings = filesystemRepository.siblingNames(absSrc);
        const srcName  = path.basename(absSrc);
        const newName  = duplicateName(srcName, siblings);
        absDest        = path.join(path.dirname(absSrc), newName);
      }

      if (filesystemRepository.exists(absDest)) {
        return { ok: false, error: `Destination already exists` };
      }

      filesystemRepository.copy(absSrc, absDest);
      metadataRepository.invalidate(absDest);

      return { ok: true, destPath: toRelative(absDest, FE_CONFIG.sandboxRoot) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const duplicateService = new DuplicateService();
