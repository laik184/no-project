/**
 * server/agents/executor/telemetry/executor-metrics.ts
 *
 * In-process metrics for the executor agent.
 * Tracks execution counts, success/failure rates, retries, and duration.
 */

import type { TaskKind } from '../types/executor.types.ts';

interface KindCounters {
  total:          number;
  success:        number;
  failed:         number;
  retries:        number;
  totalDurationMs: number;
}

const counters = new Map<TaskKind, KindCounters>();
let _sessions  = 0;
let _started   = 0;
let _finished  = 0;
let _failed    = 0;
let _retries   = 0;

function getOrCreate(kind: TaskKind): KindCounters {
  let c = counters.get(kind);
  if (!c) {
    c = { total: 0, success: 0, failed: 0, retries: 0, totalDurationMs: 0 };
    counters.set(kind, c);
  }
  return c;
}

export const executorMetrics = {
  recordSessionStarted(): void { _sessions++; },

  recordStarted(kind: TaskKind): void {
    getOrCreate(kind).total++;
    _started++;
  },

  recordCompleted(kind: TaskKind, durationMs: number): void {
    const c = getOrCreate(kind);
    c.success++;
    c.totalDurationMs += durationMs;
    _finished++;
  },

  recordFailed(kind: TaskKind, durationMs: number): void {
    const c = getOrCreate(kind);
    c.failed++;
    c.totalDurationMs += durationMs;
    _failed++;
  },

  recordRetry(kind: TaskKind): void {
    getOrCreate(kind).retries++;
    _retries++;
  },

  avgDurationMs(kind: TaskKind): number {
    const c = counters.get(kind);
    if (!c || c.success === 0) return 0;
    return Math.round(c.totalDurationMs / c.success);
  },

  successRate(kind: TaskKind): number {
    const c = counters.get(kind);
    if (!c || c.total === 0) return 0;
    return Math.round((c.success / c.total) * 100);
  },

  snapshot(): {
    global: { sessions: number; started: number; finished: number; failed: number; retries: number };
    byKind: Record<string, KindCounters>;
  } {
    const byKind: Record<string, KindCounters> = {};
    for (const [kind, c] of counters) byKind[kind] = { ...c };
    return {
      global: { sessions: _sessions, started: _started, finished: _finished, failed: _failed, retries: _retries },
      byKind,
    };
  },

  reset(): void {
    counters.clear();
    _sessions = _started = _finished = _failed = _retries = 0;
  },
};
