/**
 * server/file-explorer/repositories/history.repository.ts
 * Persists file version history as JSON files inside .nura/history/.
 * Only this repository may access the history directory.
 */

import fs   from 'fs';
import path from 'path';
import type { HistoryEntry } from '../../../shared/file-explorer-core/types/index.ts';
import { FE_CONFIG }  from '../../../shared/file-explorer-core/config/index.ts';
import { makeHistoryId } from '../../../shared/file-explorer-core/utils/index.ts';

const MAX_ENTRIES = FE_CONFIG.maxHistoryEntries;

/** Converts a file path to a stable filename for its history JSON. */
function historyFile(filePath: string): string {
  const safe = filePath.replace(/[/\\:*?"<>|]/g, '_');
  return path.join(FE_CONFIG.historyDir, `${safe}.history.json`);
}

class HistoryRepository {

  private load(filePath: string): HistoryEntry[] {
    const hPath = historyFile(filePath);
    if (!fs.existsSync(hPath)) return [];
    try {
      return JSON.parse(fs.readFileSync(hPath, 'utf-8')) as HistoryEntry[];
    } catch {
      return [];
    }
  }

  private save(filePath: string, entries: HistoryEntry[]): void {
    const hPath = historyFile(filePath);
    fs.mkdirSync(path.dirname(hPath), { recursive: true });
    fs.writeFileSync(hPath, JSON.stringify(entries, null, 2), 'utf-8');
  }

  /** Returns all history entries for a file path, newest first. */
  getHistory(filePath: string): HistoryEntry[] {
    return this.load(filePath);
  }

  /** Prepends a new snapshot to the history for filePath. Trims to MAX_ENTRIES. */
  addEntry(filePath: string, content: string, author = 'user'): HistoryEntry {
    const entries = this.load(filePath);
    const entry: HistoryEntry = {
      id:        makeHistoryId(),
      path:      filePath,
      content,
      mtime:     Date.now(),
      createdAt: Date.now(),
      author,
      sizeBytes: Buffer.byteLength(content, 'utf-8'),
    };
    entries.unshift(entry);
    this.save(filePath, entries.slice(0, MAX_ENTRIES));
    return entry;
  }

  /** Removes all history for a given file path. */
  clearHistory(filePath: string): void {
    const hPath = historyFile(filePath);
    if (fs.existsSync(hPath)) fs.unlinkSync(hPath);
  }
}

export const historyRepository = new HistoryRepository();
