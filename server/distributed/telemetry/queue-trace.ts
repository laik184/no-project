/**
 * Responsibility: Queue lifecycle telemetry — records enqueue, dequeue, queue.blocked,
 *                 distributed.retry, and dead-letter events for the task queue layer.
 * Dependencies: bus
 * Failure: all methods non-throwing; errors logged and swallowed.
 * Telemetry: this IS the telemetry module for the queue layer.
 */

import { bus }                from "../../infrastructure/events/bus.ts";
import type { TaskPriorityLevel } from "../queue/priority-queue.ts";
import type { RetryDecision }    from "../queue/queue-retry-policy.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QueueMetrics {
  enqueued:   number;
  dequeued:   number;
  blocked:    number;
  retried:    number;
  deadLetter: number;
}

// ── Trace ────────────────────────────────────────────────────────────────────

class QueueTrace {
  private readonly metrics: QueueMetrics = {
    enqueued: 0, dequeued: 0, blocked: 0, retried: 0, deadLetter: 0,
  };

  enqueued(taskId: string, runId: string, priority: TaskPriorityLevel): void {
    this.metrics.enqueued++;
    this.emit("agent.started", runId, { taskId, priority, event: "enqueued" });
  }

  dequeued(taskId: string, runId: string, priority: TaskPriorityLevel): void {
    this.metrics.dequeued++;
    this.emit("agent.completed", runId, { taskId, priority, event: "dequeued" });
  }

  queueBlocked(taskId: string, runId: string, priority: TaskPriorityLevel): void {
    this.metrics.blocked++;
    this.emit("queue.blocked", runId, { taskId, priority });
  }

  retried(taskId: string, runId: string, attempt: number, decision: RetryDecision): void {
    if (decision === "dead_letter") {
      this.metrics.deadLetter++;
      this.emit("distributed.recovery", runId, { taskId, attempt, decision });
    } else {
      this.metrics.retried++;
      this.emit("distributed.retry", runId, { taskId, attempt, decision });
    }
  }

  snapshot(): QueueMetrics {
    return { ...this.metrics };
  }

  private emit(eventType: string, runId: string, payload: Record<string, unknown>): void {
    try {
      bus.emit("agent.event", {
        runId,
        projectId: 0,
        phase:     "distributed.queue",
        agentName: "queue-trace",
        eventType,
        payload,
        ts: Date.now(),
      });
    } catch (err) {
      console.error("[queue-trace] Emit error:", err);
    }
  }
}

export const queueTrace = new QueueTrace();
