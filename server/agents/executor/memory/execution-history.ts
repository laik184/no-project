/**
 * server/agents/executor/memory/execution-history.ts
 *
 * In-process store for executor execution records, fix fingerprints, and
 * failure history. Sync reads — no async on the hot path.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type ExecutionOutcome = 'success' | 'failure' | 'partial' | 'skipped';

export interface ExecutionHistoryEntry {
  readonly id:          string;
  readonly runId:       string;
  readonly taskId:      string;
  readonly toolName:    string;
  readonly kind:        string;
  readonly outcome:     ExecutionOutcome;
  readonly errorText?:  string;
  readonly retries:     number;
  readonly durationMs:  number;
  readonly fixApplied?: string;
  readonly ts:          number;
}

export interface ExecutionHistorySummary {
  readonly totalRecorded: number;
  readonly successRate:   number;
  readonly avgRetries:    number;
  readonly topFailures:   Array<{ toolName: string; count: number }>;
}

// ── Internal state ────────────────────────────────────────────────────────────

const _entries: ExecutionHistoryEntry[] = [];
let   _seq = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────

function _failureCounts(): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of _entries) {
    if (e.outcome === 'failure') m.set(e.toolName, (m.get(e.toolName) ?? 0) + 1);
  }
  return m;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const executionHistory = {

  recordExecution(entry: Omit<ExecutionHistoryEntry, 'id' | 'ts'>): void {
    _entries.push({ ...entry, id: `eh_${++_seq}`, ts: Date.now() });
    if (_entries.length > 2000) _entries.splice(0, 200);
  },

  summary(): ExecutionHistorySummary {
    const total = _entries.length;
    if (total === 0) {
      return { totalRecorded: 0, successRate: 1, avgRetries: 0, topFailures: [] };
    }
    const successes  = _entries.filter(e => e.outcome === 'success').length;
    const totalRetry = _entries.reduce((s, e) => s + e.retries, 0);
    const failMap    = _failureCounts();
    const topFailures = [...failMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([toolName, count]) => ({ toolName, count }));
    return {
      totalRecorded: total,
      successRate:   successes / total,
      avgRetries:    totalRetry / total,
      topFailures,
    };
  },

  hasPriorFix(toolName: string, errorType: string): boolean {
    return _entries.some(
      e => e.toolName === toolName
        && e.fixApplied != null
        && (e.errorText ?? '').includes(errorType),
    );
  },

  findSimilarFailure(
    toolName: string,
    error:    string,
  ): ExecutionHistoryEntry | undefined {
    const needle = error.slice(0, 80).toLowerCase();
    return [..._entries].reverse().find(
      e => e.toolName === toolName
        && e.outcome   === 'failure'
        && (e.errorText ?? '').toLowerCase().includes(needle),
    );
  },

  all(): readonly ExecutionHistoryEntry[] {
    return _entries;
  },

  clear(): void {
    _entries.length = 0;
  },
};
