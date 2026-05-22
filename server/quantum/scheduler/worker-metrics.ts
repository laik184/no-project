/**
 * server/quantum/scheduler/worker-metrics.ts
 *
 * In-process metrics store for the centralized Worker Pool.
 * Counters and gauges — no external agent required.
 * Exposed via snapshot() for health checks and telemetry dashboards.
 */

import type { PoolMetricsSnapshot, QueueMetrics } from "./worker-types.ts";

// ── Metrics state ─────────────────────────────────────────────────────────────

interface MutableMetrics {
  active:      number;
  queued:      number;
  completed:   number;
  failed:      number;
  timedOut:    number;
  retried:     number;
  cancelled:   number;
  queuePeak:   number;
  queueTotal:  number;
  queueOut:    number;
  overflows:   number;
}

// ── Singleton metrics store ───────────────────────────────────────────────────

class WorkerMetrics {
  private readonly m: MutableMetrics = {
    active: 0, queued: 0, completed: 0, failed: 0,
    timedOut: 0, retried: 0, cancelled: 0,
    queuePeak: 0, queueTotal: 0, queueOut: 0, overflows: 0,
  };

  private _maxConcurrency = 1;

  configure(maxConcurrency: number): void {
    this._maxConcurrency = maxConcurrency;
  }

  // ── Increments ──────────────────────────────────────────────────────────────

  taskEnqueued(): void {
    this.m.queued++;
    this.m.queueTotal++;
    if (this.m.queued > this.m.queuePeak) this.m.queuePeak = this.m.queued;
  }

  taskDequeued(): void {
    if (this.m.queued > 0) this.m.queued--;
    this.m.queueOut++;
  }

  taskStarted(): void {
    this.m.active++;
  }

  taskCompleted(): void {
    if (this.m.active > 0) this.m.active--;
    this.m.completed++;
  }

  taskFailed(): void {
    if (this.m.active > 0) this.m.active--;
    this.m.failed++;
  }

  taskTimedOut(): void {
    if (this.m.active > 0) this.m.active--;
    this.m.timedOut++;
  }

  taskRetried(): void {
    this.m.retried++;
  }

  taskCancelled(): void {
    this.m.cancelled++;
    if (this.m.queued > 0) this.m.queued--;
  }

  queueOverflow(): void {
    this.m.overflows++;
  }

  // ── Snapshot ────────────────────────────────────────────────────────────────

  snapshot(): PoolMetricsSnapshot {
    const ratio = this._maxConcurrency > 0
      ? this.m.active / this._maxConcurrency
      : 0;

    const queueMetrics: QueueMetrics = {
      size:          this.m.queued,
      peakSize:      this.m.queuePeak,
      totalEnqueued: this.m.queueTotal,
      totalDequeued: this.m.queueOut,
      overflows:     this.m.overflows,
    };

    return {
      active:          this.m.active,
      queued:          this.m.queued,
      completed:       this.m.completed,
      failed:          this.m.failed,
      timedOut:        this.m.timedOut,
      retried:         this.m.retried,
      cancelled:       this.m.cancelled,
      saturationRatio: ratio,
      queueMetrics,
    };
  }

  reset(): void {
    Object.assign(this.m, {
      active: 0, queued: 0, completed: 0, failed: 0,
      timedOut: 0, retried: 0, cancelled: 0,
      queuePeak: 0, queueTotal: 0, queueOut: 0, overflows: 0,
    });
  }
}

export const workerMetrics = new WorkerMetrics();
