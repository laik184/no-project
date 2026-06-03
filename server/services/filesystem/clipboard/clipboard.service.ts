/**
 * server/file-explorer/services/clipboard/clipboard.service.ts
 * In-memory clipboard for copy/cut/paste operations.
 * Paste delegates to duplicate or rename service accordingly.
 */

import type { ClipboardEntry, ClipboardOp } from '../../../shared/file-explorer-core/types/index.ts';
import type { ClipboardResponse }           from '../../../shared/file-explorer-core/contracts/index.ts';
import { duplicateService }  from '../duplicate/index.ts';
import { renameService }     from '../rename/index.ts';
import path from 'path';

class ClipboardService {
  private entry: ClipboardEntry | null = null;

  /** Stores a path in the clipboard with the given operation. */
  store(op: ClipboardOp, filePath: string): ClipboardResponse {
    this.entry = { op, path: filePath };
    return { ok: true, clipboard: this.entry };
  }

  /** Returns the current clipboard entry (or null if empty). */
  peek(): ClipboardResponse {
    return { ok: true, clipboard: this.entry };
  }

  /** Clears the clipboard. */
  clear(): ClipboardResponse {
    this.entry = null;
    return { ok: true, clipboard: null };
  }

  /**
   * Pastes the clipboard entry into destDir.
   * copy → duplicate; cut → rename.
   * Clears clipboard after a successful cut-paste.
   */
  paste(destDir: string): ClipboardResponse {
    if (!this.entry) return { ok: false, error: 'Clipboard is empty' };
    const { op, path: srcPath } = this.entry;
    const name    = path.basename(srcPath);
    const destPath = `${destDir}/${name}`.replace(/\/+/g, '/');

    if (op === 'copy') {
      const res = duplicateService.duplicate(srcPath, destPath);
      return { ok: res.ok, clipboard: this.entry, error: res.error };
    }

    // cut → move
    const res = renameService.rename(srcPath, destPath);
    if (res.ok) this.entry = null;
    return { ok: res.ok, clipboard: this.entry, error: res.error };
  }
}

export const clipboardService = new ClipboardService();
