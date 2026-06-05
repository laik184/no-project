/**
 * server/services/terminal/session/terminal-history-service.ts
 *
 * Per-session command history with circular buffer.
 * Supports append, retrieve, search, and clear.
 *
 * Write-through pattern:
 *   _histories Map        → hot in-process cache (all reads are sync)
 *   commandRepository     → durable file-backed store (sync write-through on push)
 */

import { commandRepository } from '../../../repositories/terminal/index.ts';

export class HistoryError extends Error {
  constructor(message: string) {
    super(`[terminal-history] ${message}`);
    this.name = 'HistoryError';
  }
}

export interface HistoryEntry {
  index:     number;
  command:   string;
  timestamp: number;
  exitCode:  number | null;
}

const MAX_HISTORY = 500;
const _histories  = new Map<string, HistoryEntry[]>();

export const terminalHistoryService = {
  push(sessionId: string, command: string, exitCode: number | null = null): HistoryEntry {
    if (!_histories.has(sessionId)) _histories.set(sessionId, []);
    const history = _histories.get(sessionId)!;

    const entry: HistoryEntry = {
      index:     history.length,
      command,
      timestamp: Date.now(),
      exitCode,
    };

    history.push(entry);

    if (history.length > MAX_HISTORY) {
      history.splice(0, history.length - MAX_HISTORY);
    }

    // Write-through: persist to file-backed store immediately (sync)
    commandRepository.appendHistory(sessionId, {
      command,
      exitCode:  exitCode ?? 0,
      timestamp: entry.timestamp,
    });

    return entry;
  },

  updateExitCode(sessionId: string, index: number, exitCode: number): void {
    const history = _histories.get(sessionId);
    if (!history) return;
    const entry = history.find(e => e.index === index);
    if (entry) entry.exitCode = exitCode;
  },

  get(sessionId: string, limit = 50): HistoryEntry[] {
    const history = _histories.get(sessionId) ?? [];
    return history.slice(-Math.min(limit, MAX_HISTORY));
  },

  search(sessionId: string, query: string): HistoryEntry[] {
    const history = _histories.get(sessionId) ?? [];
    const lower   = query.toLowerCase();
    return history.filter(e => e.command.toLowerCase().includes(lower));
  },

  clear(sessionId: string): void {
    _histories.delete(sessionId);
  },

  size(sessionId: string): number {
    return _histories.get(sessionId)?.length ?? 0;
  },
};
