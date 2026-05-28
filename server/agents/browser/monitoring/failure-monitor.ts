/**
 * server/agents/browser/monitoring/failure-monitor.ts
 *
 * Tracks failed browser operations, retry attempts, and repeated failures.
 * Module-level store — no persistence, resets on restart.
 */

export interface FailureRecord {
  runId:     string;
  tool:      string;
  error:     string;
  retries:   number;
  ts:        string;
  repeated:  boolean;
}

export interface FailureSummary {
  total:        number;
  byTool:       Record<string, number>;
  repeated:     FailureRecord[];
  recentErrors: FailureRecord[];
}

// ── Internal store ────────────────────────────────────────────────────────────

const _failures    = new Map<string, FailureRecord[]>();    // runId → failures
const REPEAT_THRESHOLD = 3;
const MAX_PER_RUN  = 100;

// ── Writes ────────────────────────────────────────────────────────────────────

export function recordFailure(
  runId:   string,
  tool:    string,
  error:   string,
  retries: number = 0,
): void {
  const existing = _failures.get(runId) ?? [];
  const sameToolCount = existing.filter(f => f.tool === tool).length;
  const record: FailureRecord = {
    runId,
    tool,
    error,
    retries,
    ts:       new Date().toISOString(),
    repeated: sameToolCount >= REPEAT_THRESHOLD,
  };

  const trimmed = existing.slice(-MAX_PER_RUN + 1);
  _failures.set(runId, [...trimmed, record]);
}

export function clearFailures(runId: string): void {
  _failures.delete(runId);
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export function getFailures(runId: string): FailureRecord[] {
  return _failures.get(runId) ?? [];
}

export function hasRepeatedFailures(runId: string): boolean {
  return getFailures(runId).some(f => f.repeated);
}

export function summarizeFailures(runId: string): FailureSummary {
  const failures = getFailures(runId);
  const byTool: Record<string, number> = {};
  for (const f of failures) {
    byTool[f.tool] = (byTool[f.tool] ?? 0) + 1;
  }
  return {
    total:        failures.length,
    byTool,
    repeated:     failures.filter(f => f.repeated),
    recentErrors: failures.slice(-5),
  };
}

export function getGlobalFailureCount(): number {
  let total = 0;
  for (const records of _failures.values()) total += records.length;
  return total;
}
