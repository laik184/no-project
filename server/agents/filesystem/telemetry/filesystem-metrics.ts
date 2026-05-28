/**
 * server/agents/filesystem/telemetry/filesystem-metrics.ts
 *
 * In-process metrics for the filesystem agent.
 * Tracks operation counts, success/failure rates, retry metrics, and duration.
 */

import type { FilesystemOperationKind } from '../types/filesystem.types.ts';

// ── Internal counters ─────────────────────────────────────────────────────────

interface KindCounters {
  total:   number;
  success: number;
  failed:  number;
  retries: number;
  totalDurationMs: number;
}

const counters = new Map<FilesystemOperationKind, KindCounters>();
let globalStarted  = 0;
let globalFinished = 0;
let globalFailed   = 0;
let globalRetries  = 0;

function getOrCreate(kind: FilesystemOperationKind): KindCounters {
  let c = counters.get(kind);
  if (!c) {
    c = { total: 0, success: 0, failed: 0, retries: 0, totalDurationMs: 0 };
    counters.set(kind, c);
  }
  return c;
}

// ── Public API ────────────────────────────────────────────────────────────────

export const filesystemMetrics = {
  recordStarted(kind: FilesystemOperationKind): void {
    getOrCreate(kind).total++;
    globalStarted++;
  },

  recordCompleted(kind: FilesystemOperationKind, durationMs: number): void {
    const c = getOrCreate(kind);
    c.success++;
    c.totalDurationMs += durationMs;
    globalFinished++;
  },

  recordFailed(kind: FilesystemOperationKind, durationMs: number): void {
    const c = getOrCreate(kind);
    c.failed++;
    c.totalDurationMs += durationMs;
    globalFailed++;
  },

  recordRetry(kind: FilesystemOperationKind): void {
    getOrCreate(kind).retries++;
    globalRetries++;
  },

  snapshot(): {
    global: { started: number; finished: number; failed: number; retries: number };
    byKind: Record<string, KindCounters>;
  } {
    const byKind: Record<string, KindCounters> = {};
    for (const [kind, c] of counters) {
      byKind[kind] = { ...c };
    }
    return {
      global: {
        started:  globalStarted,
        finished: globalFinished,
        failed:   globalFailed,
        retries:  globalRetries,
      },
      byKind,
    };
  },

  avgDurationMs(kind: FilesystemOperationKind): number {
    const c = counters.get(kind);
    if (!c || c.success === 0) return 0;
    return Math.round(c.totalDurationMs / c.success);
  },

  successRate(kind: FilesystemOperationKind): number {
    const c = counters.get(kind);
    if (!c || c.total === 0) return 0;
    return Math.round((c.success / c.total) * 100);
  },

  reset(): void {
    counters.clear();
    globalStarted  = 0;
    globalFinished = 0;
    globalFailed   = 0;
    globalRetries  = 0;
  },
};
