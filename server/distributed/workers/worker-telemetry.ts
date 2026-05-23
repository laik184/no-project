/**
 * Responsibility: Telemetry for the CentralWorkerPool — submission, completion,
 *                 failure, backpressure, and capacity events.
 * Dependencies: bus
 * Failure: all methods non-throwing; errors logged and swallowed.
 * Telemetry: this IS the telemetry module for the central worker layer.
 */

import { bus }              from "../../infrastructure/events/bus.ts";
import type { WorkerTier, WorkerEventType } from "./types/index.ts";

interface WorkerMetrics {
  submitted:   number;
  completed:   number;
  failed:      number;
  backpressure: number;
}

class CentralWorkerTelemetry {
  private readonly m: WorkerMetrics = { submitted: 0, completed: 0, failed: 0, backpressure: 0 };

  onSubmitted(taskId: string, runId: string, tier: WorkerTier): void {
    this.m.submitted++;
    this.emit("worker.spawned", runId, { taskId, tier });
  }

  onCompleted(taskId: string, runId: string, durationMs: number): void {
    this.m.completed++;
    this.emit("worker.completed", runId, { taskId, durationMs });
  }

  onFailed(taskId: string, runId: string, error: string): void {
    this.m.failed++;
    this.emit("worker.failed", runId, { taskId, error });
  }

  onBackpressure(taskId: string, runId: string, tier: WorkerTier): void {
    this.m.backpressure++;
    this.emit("worker.backpressure", runId, { taskId, tier });
  }

  onHeartbeat(workerId: string): void {
    this.emit("worker.heartbeat", "system", { workerId, ts: Date.now() });
  }

  onEvicted(workerId: string, reason: string): void {
    this.emit("worker.evicted", "system", { workerId, reason });
  }

  snapshot(): WorkerMetrics { return { ...this.m }; }

  private emit(eventType: WorkerEventType, runId: string, payload: Record<string, unknown>): void {
    try {
      bus.emit("agent.event", {
        runId, projectId: 0,
        phase: "distributed.worker",
        agentName: "central-worker-telemetry",
        eventType, payload, ts: Date.now(),
      });
    } catch (err) { console.error("[central-worker-telemetry] Emit error:", err); }
  }
}

export const centralWorkerTelemetry = new CentralWorkerTelemetry();
