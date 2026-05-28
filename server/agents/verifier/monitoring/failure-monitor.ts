/**
 * server/agents/verifier/monitoring/failure-monitor.ts
 * Tracks failures, retries, and crash-loop detection.
 */

interface FailureRecord {
  runId:     string;
  stepId:    string;
  tool:      string;
  error:     string;
  attempt:   number;
  timestamp: number;
}

const CRASH_LOOP_THRESHOLD = 5;
const CRASH_LOOP_WINDOW_MS = 60_000;

const failures = new Map<string, FailureRecord[]>();
const retries  = new Map<string, number>();

export const failureMonitor = {
  recordFailure(runId: string, stepId: string, tool: string, error: string, attempt: number): void {
    const key     = runId;
    const records = failures.get(key) ?? [];
    records.push({ runId, stepId, tool, error, attempt, timestamp: Date.now() });
    if (records.length > 100) records.splice(0, 50);
    failures.set(key, records);
  },

  recordRetry(runId: string): void {
    retries.set(runId, (retries.get(runId) ?? 0) + 1);
  },

  isCrashLooping(runId: string): boolean {
    const records = failures.get(runId) ?? [];
    const now     = Date.now();
    const recent  = records.filter((r) => now - r.timestamp < CRASH_LOOP_WINDOW_MS);
    return recent.length >= CRASH_LOOP_THRESHOLD;
  },

  retryCount(runId: string): number {
    return retries.get(runId) ?? 0;
  },

  failureCount(runId: string): number {
    return (failures.get(runId) ?? []).length;
  },

  recentFailures(runId: string, windowMs = CRASH_LOOP_WINDOW_MS): FailureRecord[] {
    const now = Date.now();
    return (failures.get(runId) ?? []).filter((r) => now - r.timestamp < windowMs);
  },

  clear(runId: string): void {
    failures.delete(runId);
    retries.delete(runId);
  },
};
