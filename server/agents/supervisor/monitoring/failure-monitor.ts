/**
 * server/agents/supervisor/monitoring/failure-monitor.ts
 *
 * Tracks orchestration failures, retry counts, stuck workflows,
 * and crash/escalation patterns per supervision run.
 * Pure state store — no tool calls, no direct execution.
 */

import type { AgentDomain } from '../types/supervisor.types.ts';

interface FailureRecord {
  taskId:    string;
  domain:    AgentDomain;
  error:     string;
  attempt:   number;
  timestamp: number;
}

interface EscalationRecord {
  taskId:    string;
  domain:    AgentDomain;
  reason:    string;
  timestamp: number;
}

interface RunFailureState {
  runId:       string;
  failures:    FailureRecord[];
  retries:     number;
  escalations: EscalationRecord[];
}

const MAX_RECORDS_PER_RUN = 100;
const CRASH_LOOP_WINDOW_MS = 30_000;

const store = new Map<string, RunFailureState>();

export const failureMonitor = {
  initRun(runId: string): void {
    store.set(runId, { runId, failures: [], retries: 0, escalations: [] });
  },

  recordFailure(
    runId:   string,
    taskId:  string,
    domain:  AgentDomain,
    error:   string,
    attempt: number,
  ): void {
    if (!store.has(runId)) this.initRun(runId);
    const state = store.get(runId)!;
    state.failures.push({ taskId, domain, error, attempt, timestamp: Date.now() });
    if (state.failures.length > MAX_RECORDS_PER_RUN) state.failures.shift();
  },

  recordRetry(runId: string): void {
    if (!store.has(runId)) this.initRun(runId);
    store.get(runId)!.retries++;
  },

  recordEscalation(runId: string, taskId: string, domain: AgentDomain, reason: string): void {
    if (!store.has(runId)) this.initRun(runId);
    const state = store.get(runId)!;
    state.escalations.push({ taskId, domain, reason, timestamp: Date.now() });
    if (state.escalations.length > MAX_RECORDS_PER_RUN) state.escalations.shift();
  },

  countForRun(runId: string): number {
    return store.get(runId)?.failures.length ?? 0;
  },

  retriesForRun(runId: string): number {
    return store.get(runId)?.retries ?? 0;
  },

  escalationsForRun(runId: string): number {
    return store.get(runId)?.escalations.length ?? 0;
  },

  listFailures(runId: string): readonly FailureRecord[] {
    return Object.freeze(store.get(runId)?.failures ?? []);
  },

  listEscalations(runId: string): readonly EscalationRecord[] {
    return Object.freeze(store.get(runId)?.escalations ?? []);
  },

  /** Returns the dominant error pattern (most frequent) for a run. */
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

  /** Detects crash-loop: N failures within CRASH_LOOP_WINDOW_MS. */
  isCrashLooping(runId: string, threshold = 5): boolean {
    const s = store.get(runId);
    if (!s || s.failures.length < threshold) return false;
    const recent = s.failures.slice(-threshold);
    const window = recent[threshold - 1].timestamp - recent[0].timestamp;
    return window < CRASH_LOOP_WINDOW_MS;
  },

  clearRun(runId: string): void {
    store.delete(runId);
  },

  allRunIds(): readonly string[] {
    return Object.freeze([...store.keys()]);
  },
};
