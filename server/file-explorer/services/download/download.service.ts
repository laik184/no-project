/**
 * server/file-explorer/services/download/download.service.ts
 * Creates a zip archive of the sandbox (or a sub-path) for download.
 */

import { FE_CONFIG }   from '../../config/index.ts';
import { resolveSafe } from '../../guards/index.ts';
import { zipDirectory } from '../../utils/index.ts';

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
