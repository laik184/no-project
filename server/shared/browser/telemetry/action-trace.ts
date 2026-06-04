/**
 * server/agents/browser/telemetry/action-trace.ts
 *
 * Per-run ordered action trace.
 * Consumed by tools layer (action-logger.ts) and orchestration layer.
 */

export interface TraceEntry {
  action:     string;
  target?:    string;
  value?:     string;
  success:    boolean;
  durationMs: number;
  ts:         string;
}

// ── Store ─────────────────────────────────────────────────────────────────────

const _store   = new Map<string, TraceEntry[]>();
const MAX_ROWS = 500;

// ── Singleton ─────────────────────────────────────────────────────────────────

export const actionTrace = {
  record(
    runId:   string,
    entry:   Omit<TraceEntry, 'ts'>,
  ): void {
    const list = _store.get(runId) ?? [];
    if (list.length >= MAX_ROWS) list.shift();
    list.push({ ...entry, ts: new Date().toISOString() });
    _store.set(runId, list);
  },

  getAll(runId: string): TraceEntry[] {
    return _store.get(runId) ?? [];
  },

  getLast(runId: string, n = 10): TraceEntry[] {
    return (_store.get(runId) ?? []).slice(-n);
  },

  clear(runId: string): void {
    _store.delete(runId);
  },

  count(runId: string): number {
    return (_store.get(runId) ?? []).length;
  },
};
