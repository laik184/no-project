/**
 * server/file-explorer/services/history/history.service.ts
 * Manages file version history (snapshot before each save).
 */

import { historyRepository }  from '../../repositories/filesystem/index.ts';
import { readService }        from '../read/index.ts';
import { writeService }       from '../write/index.ts';
import type { HistoryResponse } from '../../shared/file-explorer-core/contracts/index.ts';

class HistoryService {

  /**
   * Snapshots the current content of filePath into history, then saves new content.
   * Called by the orchestrator around every write operation.
   */
  snapshotBeforeWrite(filePath: string): void {
    const read = readService.readFile(filePath);
    if (read.ok && read.content !== undefined) {
      historyRepository.addEntry(filePath, read.content);
    }
  }

  /** Returns all history entries for a file, newest first. */
  getHistory(filePath: string): HistoryResponse {
    try {
      const entries = historyRepository.getHistory(filePath);
      return { ok: true, history: entries, total: entries.length };
    } catch (err) {
      return { ok: false, history: [], total: 0, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Restores a file to a specific history entry, saving its content back to disk.
   * The current state is snapshotted before restore.
   */
  restoreVersion(filePath: string, historyId: string): HistoryResponse {
    try {
      const entries = historyRepository.getHistory(filePath);
      const target  = entries.find(e => e.id === historyId);
      if (!target) return { ok: false, history: [], total: 0, error: `History entry not found: ${historyId}` };

      this.snapshotBeforeWrite(filePath);
      writeService.saveFile(filePath, target.content);
      return { ok: true, history: entries, total: entries.length };
    } catch (err) {
      return { ok: false, history: [], total: 0, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const historyService = new HistoryService();
