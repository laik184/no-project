/**
 * Responsibility: Telemetry for the distributed BullMQ queue layer — enqueue,
 *                 dequeue, backpressure, retry, dead-letter, and drain events.
 * Dependencies: bus
 * Failure: all methods non-throwing; errors logged and swallowed.
 * Telemetry: this IS the telemetry module for the distributed queue.
 */

import { bus }                  from "../../infrastructure/events/bus.ts";
import type { TaskPriorityLevel } from "./priority-queue.ts";
import type { QueueEventType }   from "./types/index.ts";

interface QueueMetrics {
  enqueued:   number;
  dequeued:   number;
  backpressure: number;
  retried:    number;
  deadLetter: number;
  drained:    number;
}

class DistributedQueueTelemetry {
  private readonly m: QueueMetrics = {
    enqueued: 0, dequeued: 0, backpressure: 0, retried: 0, deadLetter: 0, drained: 0,
  };

  onEnqueued(taskId: string, runId: string, priority: TaskPriorityLevel): void {
    this.m.enqueued++;
    this.emit("queue.enqueued", runId, { taskId, priority });
  }

  onDequeued(taskId: string, runId: string, priority: TaskPriorityLevel): void {
    this.m.dequeued++;
    this.emit("queue.dequeued", runId, { taskId, priority });
  }

  onBackpressure(taskId: string, runId: string, priority: TaskPriorityLevel): void {
    this.m.backpressure++;
    this.emit("queue.backpressure", runId, { taskId, priority });
  }

  onRetried(taskId: string, runId: string, attempt: number): void {
    this.m.retried++;
    this.emit("queue.retried", runId, { taskId, attempt });
  }

  onDeadLetter(taskId: string, runId: string, reason: string): void {
    this.m.deadLetter++;
    this.emit("queue.dead_letter", runId, { taskId, reason });
  }

  onCompleted(taskId: string, runId: string, durationMs: number): void {
    this.emit("queue.completed", runId, { taskId, durationMs });
  }

  onFailed(taskId: string, runId: string, error: string): void {
    this.emit("queue.failed", runId, { taskId, error });
  }

  onDrained(queueName: string): void {
    this.m.drained++;
    this.emit("queue.drained", "system", { queueName });
  }

  onStalled(taskId: string, runId: string): void {
    this.emit("queue.stalled", runId, { taskId });
  }

  snapshot(): QueueMetrics { return { ...this.m }; }

  private emit(eventType: QueueEventType, runId: string, payload: Record<string, unknown>): void {
    try {
      bus.emit("agent.event", {
        runId, projectId: 0,
        phase: "distributed.queue",
        agentName: "distributed-queue-telemetry",
        eventType, payload, ts: Date.now(),
      });
    } catch (err) { console.error("[distributed-queue-telemetry] Emit error:", err); }
  }
}

export const distributedQueueTelemetry = new DistributedQueueTelemetry();
