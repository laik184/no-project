/**
 * server/agents/executor/monitoring/failure-monitor.ts
 *
 * Tracks failed executions, retry attempts, and repeated failures.
 * Enhanced with retry-storm detection, infinite-loop guards, and
 * dead-execution identification via sliding-window analysis.
 *
 * Pure in-process monitor — no execution logic.
 */

import type { ExecutionFailureRecord, TaskKind } from '../types/executor.types.ts';

const _failures = new Map<string, ExecutionFailureRecord[]>();
const STUCK_THRESHOLD    = 4;
const REPEATED_THRESHOLD = 3;

// Storm detection — sliding window
const STORM_WINDOW_MS  = 30_000;
const STORM_THRESHOLD  = 12;
const _recentFailureTimes: number[] = [];

// Infinite-loop guard — same step failing in a tight loop
const LOOP_WINDOW_MS   = 10_000;
const LOOP_THRESHOLD   = 5;
const _stepTimestamps  = new Map<string, number[]>(); // stepId → recent failure timestamps

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
    const rec: ExecutionFailureRecord = {
      stepId, taskId, runId, kind, toolName, error, retryCount,
      timestamp: new Date(),
    };
    const existing = _failures.get(stepId) ?? [];
    existing.push(rec);
    _failures.set(stepId, existing);

    // Track recent failure timestamps for storm detection
    const now = Date.now();
    _recentFailureTimes.push(now);

    // Track per-step timestamps for infinite-loop detection
    const stepTs = _stepTimestamps.get(stepId) ?? [];
    stepTs.push(now);
    _stepTimestamps.set(stepId, stepTs);

    if (retryCount >= STUCK_THRESHOLD) {
      console.warn(
        `[failure-monitor] Stuck step — stepId=${stepId} taskId=${taskId} retries=${retryCount}`,
      );
    }
    if (existing.length >= REPEATED_THRESHOLD) {
      console.warn(
        `[failure-monitor] Repeated failure — stepId=${stepId} occurrences=${existing.length}`,
      );
    }
    if (this.isRetryStorm()) {
      console.warn(
        `[failure-monitor] RETRY STORM detected — ${STORM_THRESHOLD}+ failures in ${STORM_WINDOW_MS / 1000}s`,
      );
    }
    if (this.isInfiniteLoop(stepId)) {
      console.warn(
        `[failure-monitor] INFINITE LOOP suspected — stepId=${stepId} failed ${LOOP_THRESHOLD}+ times in ${LOOP_WINDOW_MS / 1000}s`,
      );
    }
  },

  isStuck(stepId: string): boolean {
    const recs = _failures.get(stepId);
    if (!recs || recs.length === 0) return false;
    return recs[recs.length - 1].retryCount >= STUCK_THRESHOLD;
  },

  /**
   * Retry storm: too many distinct failures across ALL steps in a short window.
   */
  isRetryStorm(): boolean {
    const cutoff = Date.now() - STORM_WINDOW_MS;
    const recent = _recentFailureTimes.filter((t) => t >= cutoff).length;
    return recent >= STORM_THRESHOLD;
  },

  /**
   * Infinite loop: the SAME step has failed repeatedly in a very tight window.
   */
  isInfiniteLoop(stepId: string): boolean {
    const timestamps = _stepTimestamps.get(stepId) ?? [];
    const cutoff     = Date.now() - LOOP_WINDOW_MS;
    const recent     = timestamps.filter((t) => t >= cutoff).length;
    return recent >= LOOP_THRESHOLD;
  },

  /**
   * Dead execution: a step has been retried many times over a long period
   * with no progress — different from a storm (slow/steady failure pattern).
   */
  isDeadExecution(stepId: string): boolean {
    const recs = _failures.get(stepId);
    if (!recs || recs.length < STUCK_THRESHOLD) return false;
    const oldest = recs[0].timestamp.getTime();
    const newest = recs[recs.length - 1].timestamp.getTime();
    return (newest - oldest) > 60_000 && recs[recs.length - 1].retryCount >= STUCK_THRESHOLD;
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

  summary(): {
    totalStepsFailed: number;
    stuckSteps:       string[];
    repeatedFailures: string[];
    retryStorm:       boolean;
    deadExecutions:   string[];
  } {
    const stuck: string[] = [];
    const repeated: string[] = [];
    const dead: string[] = [];

    for (const [stepId, recs] of _failures) {
      if (recs.length === 0) continue;
      if (recs[recs.length - 1].retryCount >= STUCK_THRESHOLD) stuck.push(stepId);
      if (recs.length >= REPEATED_THRESHOLD) repeated.push(stepId);
      if (this.isDeadExecution(stepId)) dead.push(stepId);
    }

    return {
      totalStepsFailed: _failures.size,
      stuckSteps:       stuck,
      repeatedFailures: repeated,
      retryStorm:       this.isRetryStorm(),
      deadExecutions:   dead,
    };
  },

  /** Prune old timestamps from the sliding windows (call periodically). */
  pruneWindows(): void {
    const cutoffStorm = Date.now() - STORM_WINDOW_MS;
    const cutoffLoop  = Date.now() - LOOP_WINDOW_MS;
    while (_recentFailureTimes.length > 0 && _recentFailureTimes[0] < cutoffStorm) {
      _recentFailureTimes.shift();
    }
    for (const [stepId, ts] of _stepTimestamps) {
      const pruned = ts.filter((t) => t >= cutoffLoop);
      if (pruned.length === 0) _stepTimestamps.delete(stepId);
      else _stepTimestamps.set(stepId, pruned);
    }
  },

  clear(stepId: string): void {
    _failures.delete(stepId);
    _stepTimestamps.delete(stepId);
  },

  reset(): void {
    _failures.clear();
    _stepTimestamps.clear();
    _recentFailureTimes.length = 0;
  },
};
