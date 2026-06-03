/**
 * server/file-explorer/services/download/download.service.ts
 * Creates a zip archive of the sandbox (or a sub-path) for download.
 */

import { FE_CONFIG }   from '../../../shared/file-explorer-core/config/index.ts';
import { resolveSafe } from '../../../shared/file-explorer-core/guards/index.ts';
import { zipDirectory } from '../../../shared/file-explorer-core/utils/index.ts';

interface DownloadResult {
  ok:       boolean;
  buffer?:  Buffer;
  filename: string;
  mimeType: string;
  error?:   string;
}

class DownloadService {

  /**
   * Zips the given project path (defaults to sandbox root) and returns a Buffer.
   */
  async download(projectPath?: string): Promise<DownloadResult> {
    try {
      const abs      = projectPath ? resolveSafe(projectPath) : FE_CONFIG.sandboxRoot;
      const buffer   = await zipDirectory(abs);
      const filename = 'project-files.zip';
      return { ok: true, buffer, filename, mimeType: 'application/zip' };
    } catch (err) {
      return {
        ok:       false,
        filename: 'project-files.zip',
        mimeType: 'application/zip',
        error:    err instanceof Error ? err.message : String(err),
      };
    }
  }
}

export const downloadService = new DownloadService();
