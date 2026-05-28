/**
 * server/agents/terminal/monitoring/failure-monitor.ts
 *
 * Tracks failed executions, retry counts, and crash patterns
 * across all active terminal agent runs.
 */

import type { FailureRecord } from '../types/terminal.types.ts';

const MAX_FAILURES_PER_RUN = 500;
const store = new Map<string, FailureRecord[]>();

export const failureMonitor = {
  record(runId: string, stepId: string, error: string, attempts: number): void {
    const entry: FailureRecord = {
      runId,
      stepId,
      error,
      attempts,
      recordedAt: Date.now(),
    };

    if (!store.has(runId)) store.set(runId, []);
    const list = store.get(runId)!;
    list.push(entry);
    if (list.length > MAX_FAILURES_PER_RUN) list.shift();
  },

  countForRun(runId: string): number {
    return store.get(runId)?.length ?? 0;
  },

  listForRun(runId: string): readonly FailureRecord[] {
    return Object.freeze(store.get(runId) ?? []);
  },

  /** Detect repeated crash pattern: same error string > threshold. */
  hasCrashPattern(runId: string, threshold = 3): boolean {
    const list = store.get(runId);
    if (!list || list.length < threshold) return false;

    const recent = list.slice(-threshold);
    const first  = recent[0].error.slice(0, 80);
    return recent.every((f) => f.error.slice(0, 80) === first);
  },

  /** Detect high retry count pattern. */
  hasHighRetryCount(runId: string, threshold = 10): boolean {
    const list = store.get(runId);
    if (!list) return false;
    const totalRetries = list.reduce((sum, f) => sum + f.attempts, 0);
    return totalRetries >= threshold;
  },

  clearRun(runId: string): void {
    store.delete(runId);
  },

  summary(runId: string): { total: number; crashPattern: boolean; highRetries: boolean } {
    return {
      total:        this.countForRun(runId),
      crashPattern: this.hasCrashPattern(runId),
      highRetries:  this.hasHighRetryCount(runId),
    };
  },
};
