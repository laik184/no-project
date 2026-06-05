/**
 * server/terminal/persistence/file/terminal-history-store.ts
 *
 * File-based command history persistence.
 * Writes per-session JSONL files to the sandbox history directory.
 */

import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'fs';
import { join } from 'path';

const HISTORY_DIR = join(process.env.AGENT_PROJECT_ROOT ?? '.sandbox', '.terminal-history');

function ensureDir(): void {
  if (!existsSync(HISTORY_DIR)) mkdirSync(HISTORY_DIR, { recursive: true });
}

function historyPath(sessionId: string): string {
  return join(HISTORY_DIR, `${sessionId}.jsonl`);
}

export interface HistoryRecord {
  command:   string;
  exitCode:  number | null;
  timestamp: number;
}

export const terminalHistoryStore = {
  append(sessionId: string, record: HistoryRecord): void {
    try {
      ensureDir();
      appendFileSync(historyPath(sessionId), JSON.stringify(record) + '\n', 'utf8');
    } catch { /* file I/O failure is non-fatal */ }
  },

  read(sessionId: string, limit = 100): HistoryRecord[] {
    try {
      const path = historyPath(sessionId);
      if (!existsSync(path)) return [];
      const lines = readFileSync(path, 'utf8').trim().split('\n').filter(Boolean);
      return lines
        .slice(-limit)
        .map(l => { try { return JSON.parse(l) as HistoryRecord; } catch { return null; } })
        .filter((r): r is HistoryRecord => r !== null);
    } catch { return []; }
  },

  search(sessionId: string, query: string): HistoryRecord[] {
    const lower = query.toLowerCase();
    return this.read(sessionId, 1000).filter(r => r.command.toLowerCase().includes(lower));
  },
};
