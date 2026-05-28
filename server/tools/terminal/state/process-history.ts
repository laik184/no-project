/**
 * server/tools/terminal/state/process-history.ts
 *
 * In-process execution history store for terminal process records.
 */

import { randomUUID } from 'crypto';

export interface ProcessHistoryEntry {
  id:         string;
  runId:      string;
  command:    string;
  pid:        number;
  exitCode:   number;
  durationMs: number;
  startedAt:  Date;
  endedAt:    Date;
}

const MAX_ENTRIES_PER_RUN = 200;
const store = new Map<string, ProcessHistoryEntry[]>();

export const processHistory = {
  record(
    runId:      string,
    command:    string,
    pid:        number,
    exitCode:   number,
    durationMs: number,
    startedAt:  Date,
  ): ProcessHistoryEntry {
    const entry: ProcessHistoryEntry = {
      id:        randomUUID().replace(/-/g, '').slice(0, 12),
      runId, command, pid, exitCode, durationMs, startedAt,
      endedAt: new Date(),
    };
    if (!store.has(runId)) store.set(runId, []);
    const list = store.get(runId)!;
    list.push(entry);
    if (list.length > MAX_ENTRIES_PER_RUN) list.shift();
    return entry;
  },

  getForRun(runId: string): readonly ProcessHistoryEntry[] {
    return Object.freeze(store.get(runId) ?? []);
  },

  countFailures(runId: string): number {
    return (store.get(runId) ?? []).filter((e) => e.exitCode !== 0).length;
  },

  clear(runId: string): void { store.delete(runId); },

  allRunIds(): readonly string[] { return Object.freeze([...store.keys()]); },
};
