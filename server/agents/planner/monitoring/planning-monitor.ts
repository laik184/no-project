/**
 * server/agents/planner/monitoring/planning-monitor.ts
 *
 * Tracks planning failures, retry attempts, invalid plans,
 * and stuck planning loops per run.
 * Pure state store — no tool calls, no direct execution.
 */

interface FailureRecord {
  phase:     string;
  error:     string;
  attempt:   number;
  timestamp: number;
}

interface StuckRecord {
  phase:     string;
  since:     number;
}

interface RunMonitorState {
  runId:           string;
  failures:        FailureRecord[];
  retries:         number;
  invalidPlans:    number;
  stuckPhases:     StuckRecord[];
}

const MAX_RECORDS_PER_RUN = 100;
const CRASH_LOOP_WINDOW_MS = 30_000;

const store = new Map<string, RunMonitorState>();

export const planningMonitor = {
  initRun(runId: string): void {
    store.set(runId, { runId, failures: [], retries: 0, invalidPlans: 0, stuckPhases: [] });
  },

  recordFailure(runId: string, phase: string, error: string, attempt: number): void {
    if (!store.has(runId)) this.initRun(runId);
    const s = store.get(runId)!;
    s.failures.push({ phase, error, attempt, timestamp: Date.now() });
    if (s.failures.length > MAX_RECORDS_PER_RUN) s.failures.shift();
  },

  recordRetry(runId: string): void {
    if (!store.has(runId)) this.initRun(runId);
    store.get(runId)!.retries++;
  },

  recordInvalidPlan(runId: string): void {
    if (!store.has(runId)) this.initRun(runId);
    store.get(runId)!.invalidPlans++;
  },

  recordStuck(runId: string, phase: string): void {
    if (!store.has(runId)) this.initRun(runId);
    const s = store.get(runId)!;
    s.stuckPhases.push({ phase, since: Date.now() });
    if (s.stuckPhases.length > MAX_RECORDS_PER_RUN) s.stuckPhases.shift();
  },

  failureCount(runId: string): number {
    return store.get(runId)?.failures.length ?? 0;
  },

  retryCount(runId: string): number {
    return store.get(runId)?.retries ?? 0;
  },

  invalidPlanCount(runId: string): number {
    return store.get(runId)?.invalidPlans ?? 0;
  },

  listFailures(runId: string): readonly FailureRecord[] {
    return Object.freeze(store.get(runId)?.failures ?? []);
  },

  /** Detects planning crash-loop: N failures within CRASH_LOOP_WINDOW_MS. */
  isCrashLooping(runId: string, threshold = 5): boolean {
    const s = store.get(runId);
    if (!s || s.failures.length < threshold) return false;
    const recent = s.failures.slice(-threshold);
    const window = recent[threshold - 1].timestamp - recent[0].timestamp;
    return window < CRASH_LOOP_WINDOW_MS;
  },

  /** Returns the dominant error pattern for a run (most frequent). */
  dominantPattern(runId: string): string | undefined {
    const failures = store.get(runId)?.failures ?? [];
    if (failures.length === 0) return undefined;
    const freq = new Map<string, number>();
    for (const f of failures) {
      const key = f.error.slice(0, 80);
      freq.set(key, (freq.get(key) ?? 0) + 1);
    }
    let max = 0;
    let pattern: string | undefined;
    for (const [k, v] of freq) {
      if (v > max) { max = v; pattern = k; }
    }
    return pattern;
  },

  clearRun(runId: string): void {
    store.delete(runId);
  },

  allRunIds(): readonly string[] {
    return Object.freeze([...store.keys()]);
  },
};
