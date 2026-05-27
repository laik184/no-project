/**
 * action-trace.ts
 * Per-run ordered action trace — records every browser action for reports.
 */

import type { ActionEntry } from '../types/reporting.types.ts';

const traces = new Map<string, ActionEntry[]>();

const MAX_ENTRIES_PER_RUN = 500;

export const actionTrace = {
  record(runId: string, entry: Omit<ActionEntry, 'timestamp'>): void {
    if (!traces.has(runId)) traces.set(runId, []);
    const list = traces.get(runId)!;
    if (list.length >= MAX_ENTRIES_PER_RUN) list.shift();
    list.push({ ...entry, timestamp: Date.now() });
  },

  getAll(runId: string): ActionEntry[] {
    return traces.get(runId) ?? [];
  },

  getFailures(runId: string): ActionEntry[] {
    return (traces.get(runId) ?? []).filter((e) => !e.success);
  },

  count(runId: string): number {
    return (traces.get(runId) ?? []).length;
  },

  evict(runId: string): void {
    traces.delete(runId);
  },
};
