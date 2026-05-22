/**
 * Responsibility: Worker lifecycle telemetry — records worker.started, worker.completed,
 *                 worker.failed, and distributed.retry events with timing and context.
 * Dependencies: bus
 * Failure: all methods non-throwing; errors logged and swallowed.
 * Telemetry: this IS the telemetry module for the worker layer.
 */

import { bus } from "../../infrastructure/events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WorkerMetrics {
  started:    number;
  completed:  number;
  failed:     number;
  retried:    number;
  totalTimeMs: number;
}

// ── Trace ────────────────────────────────────────────────────────────────────

class WorkerTrace {
  private readonly metrics: WorkerMetrics = {
    started: 0, completed: 0, failed: 0, retried: 0, totalTimeMs: 0,
  };

  workerStarted(workerId: string, taskId: string, runId: string): void {
    this.metrics.started++;
    this.emit("worker.started", runId, { workerId, taskId });
  }

  workerCompleted(workerId: string, taskId: string, durationMs: number): void {
    this.metrics.completed++;
    this.metrics.totalTimeMs += durationMs;
    this.emit("worker.completed", workerId, { workerId, taskId, durationMs });
  }

  workerFailed(workerId: string, taskId: string, reason: string): void {
    this.metrics.failed++;
    this.emit("worker.failed", workerId, { workerId, taskId, reason });
  }

  retried(workerId: string, taskId: string, attempt: number): void {
    this.metrics.retried++;
    this.emit("distributed.retry", workerId, { workerId, taskId, attempt });
  }

  snapshot(): WorkerMetrics {
    return { ...this.metrics };
  }

  avgDurationMs(): number {
    if (this.metrics.completed === 0) return 0;
    return this.metrics.totalTimeMs / this.metrics.completed;
  }

  private emit(eventType: string, runId: string, payload: Record<string, unknown>): void {
    try {
      bus.emit("agent.event", {
        runId,
        projectId: 0,
        phase:     "distributed.worker",
        agentName: "worker-trace",
        eventType,
        payload,
        ts: Date.now(),
      });
    } catch (err) {
      console.error("[worker-trace] Emit error:", err);
    }
  }
}

export const workerTrace = new WorkerTrace();
