/**
 * server/agents/executor/monitoring/failure-monitor.ts
 *
 * Tracks failed executions, retry attempts, and repeated failures.
 * Pure in-process monitor — no execution logic.
 */

import type { ExecutionFailureRecord, TaskKind } from '../types/executor.types.ts';

const _failures = new Map<string, ExecutionFailureRecord[]>();
const STUCK_THRESHOLD    = 4;
const REPEATED_THRESHOLD = 3;

export const failureMonitor = {
  record(
    stepId:     string,
    taskId:     string,
    runId:      string,
    kind:       TaskKind,
    toolName:   string,
    error:      string,
    retryCount: number,
  ): void {
    const rec: ExecutionFailureRecord = { stepId, taskId, runId, kind, toolName, error, retryCount, timestamp: new Date() };
    const existing = _failures.get(stepId) ?? [];
    existing.push(rec);
    _failures.set(stepId, existing);

    if (retryCount >= STUCK_THRESHOLD) {
      console.warn(`[failure-monitor] Stuck step detected — stepId=${stepId} taskId=${taskId} retries=${retryCount}`);
    }
    if (existing.length >= REPEATED_THRESHOLD) {
      console.warn(`[failure-monitor] Repeated failure — stepId=${stepId} occurrences=${existing.length}`);
    }
  },

  isStuck(stepId: string): boolean {
    const recs = _failures.get(stepId);
    if (!recs || recs.length === 0) return false;
    return recs[recs.length - 1].retryCount >= STUCK_THRESHOLD;
  },

  failureCount(stepId: string): number {
    return _failures.get(stepId)?.length ?? 0;
  },

  getFailures(stepId: string): ExecutionFailureRecord[] {
    return _failures.get(stepId) ?? [];
  },

  allFailures(): ExecutionFailureRecord[] {
    return [..._failures.values()].flat();
  },

  summary(): { totalStepsFailed: number; stuckSteps: string[]; repeatedFailures: string[] } {
    const stuck: string[] = [], repeated: string[] = [];
    for (const [stepId, recs] of _failures) {
      if (recs.length === 0) continue;
      if (recs[recs.length - 1].retryCount >= STUCK_THRESHOLD) stuck.push(stepId);
      if (recs.length >= REPEATED_THRESHOLD) repeated.push(stepId);
    }
    return { totalStepsFailed: _failures.size, stuckSteps: stuck, repeatedFailures: repeated };
  },

  clear(stepId: string): void { _failures.delete(stepId); },
  reset(): void { _failures.clear(); },
};
