import type { ProcessHistoryEntry } from '../types/process.types.ts';

const MAX_ENTRIES = 500;
const history: ProcessHistoryEntry[] = [];

export const processHistory = {
  record(entry: ProcessHistoryEntry): void {
    if (history.length >= MAX_ENTRIES) history.shift();
    history.push(entry);
  },

  getForRun(runId: string): ProcessHistoryEntry[] {
    return history.filter((e) => e.runId === runId);
  },

  getRecent(n = 20): ProcessHistoryEntry[] {
    return history.slice(-n);
  },

  getFailures(runId?: string): ProcessHistoryEntry[] {
    return history.filter((e) =>
      e.exitCode !== 0 && (!runId || e.runId === runId),
    );
  },

  clear(runId?: string): void {
    if (!runId) { history.length = 0; return; }
    const toRemove = history.filter((e) => e.runId === runId);
    for (const e of toRemove) history.splice(history.indexOf(e), 1);
  },

  count(): number { return history.length; },
};
