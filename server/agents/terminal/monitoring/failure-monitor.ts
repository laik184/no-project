/**
 * server/agents/terminal/monitoring/failure-monitor.ts
 *
 * Tracks failed executions, retry counts, and crash patterns per run.
 * Pure state store — no tool calls, no direct execution.
 */

interface FailureRecord {
  stepId:    string;
  stepType:  string;
  error:     string;
  attempt:   number;
  timestamp: number;
}

interface RunFailureState {
  runId:    string;
  failures: FailureRecord[];
  retries:  number;
}

const MAX_FAILURES_PER_RUN = 100;
const store = new Map<string, RunFailureState>();

export const failureMonitor = {
  initRun(runId: string): void {
    store.set(runId, { runId, failures: [], retries: 0 });
  },

  recordFailure(runId: string, stepId: string, stepType: string, error: string, attempt: number): void {
    if (!store.has(runId)) this.initRun(runId);
    const state = store.get(runId)!;
    state.failures.push({ stepId, stepType, error, attempt, timestamp: Date.now() });
    if (state.failures.length > MAX_FAILURES_PER_RUN) state.failures.shift();
  },

  recordRetry(runId: string): void {
    if (!store.has(runId)) this.initRun(runId);
    store.get(runId)!.retries++;
  },

  countForRun(runId: string): number {
    return store.get(runId)?.failures.length ?? 0;
  },

  retriesForRun(runId: string): number {
    return store.get(runId)?.retries ?? 0;
  },

  listForRun(runId: string): readonly FailureRecord[] {
    return Object.freeze(store.get(runId)?.failures ?? []);
  },

  /** Returns the most common error pattern for a run. */
  dominantPattern(runId: string): string | undefined {
    const failures = store.get(runId)?.failures ?? [];
    if (failures.length === 0) return undefined;
    const freq = new Map<string, number>();
    for (const f of failures) {
      const key = f.error.slice(0, 80);
      freq.set(key, (freq.get(key) ?? 0) + 1);
    }
    let max = 0; let pattern: string | undefined;
    for (const [k, v] of freq) { if (v > max) { max = v; pattern = k; } }
    return pattern;
  },

  isCrashLooping(runId: string, threshold = 5): boolean {
    const s = store.get(runId);
    if (!s || s.failures.length < threshold) return false;
    const recent = s.failures.slice(-threshold);
    const window = recent[threshold - 1].timestamp - recent[0].timestamp;
    return window < 30_000;
  },

  clearRun(runId: string): void { store.delete(runId); },

  allRunIds(): readonly string[] { return Object.freeze([...store.keys()]); },
};
