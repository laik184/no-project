/**
 * Responsibility: Queue-layer telemetry tracer — tracks enqueue, dequeue, block,
 *                 retry, and stall events. Enhanced with distributed span correlation.
 * Dependencies: execution-span, bus
 * Failure: all methods non-throwing; errors logged and swallowed.
 * Telemetry: emits trace events via bus.
 */

import { executionSpan } from "./execution-span.ts";
import { bus }           from "../../infrastructure/events/bus.ts";

interface QueueTraceSnapshot {
  enqueued:   number;
  dequeued:   number;
  blocked:    number;
  retried:    number;
  stalled:    number;
}

class QueueTrace {
  private counts: QueueTraceSnapshot = { enqueued: 0, dequeued: 0, blocked: 0, retried: 0, stalled: 0 };
  private readonly activeSpans = new Map<string, string>();

  enqueued(taskId: string, runId: string, priority: string): void {
    this.counts.enqueued++;
    const spanId = executionSpan.start(`queue:job:${priority}`, runId, { taskId, priority });
    this.activeSpans.set(taskId, spanId);
    this.emit("trace.queue.enqueued", runId, { taskId, priority, spanId });
  }

  dequeued(taskId: string, runId: string, priority: string): void {
    this.counts.dequeued++;
    this.emit("trace.queue.dequeued", runId, { taskId, priority });
  }

  queueBlocked(taskId: string, runId: string, priority: string): void {
    this.counts.blocked++;
    this.emit("trace.queue.blocked", runId, { taskId, priority });
  }

  retried(taskId: string, runId: string, attempts: number, decision: string): void {
    this.counts.retried++;
    this.emit("trace.queue.retried", runId, { taskId, attempts, decision });
  }

  onJobCompleted(taskId: string, runId: string, durationMs: number): void {
    const spanId = this.activeSpans.get(taskId);
    if (spanId) { executionSpan.end(spanId, "ok"); this.activeSpans.delete(taskId); }
    this.emit("trace.queue.completed", runId, { taskId, durationMs });
  }

  onJobFailed(taskId: string, runId: string, error: string): void {
    const spanId = this.activeSpans.get(taskId);
    if (spanId) { executionSpan.end(spanId, "error", error); this.activeSpans.delete(taskId); }
    this.emit("trace.queue.failed", runId, { taskId, error });
  }

  onJobStalled(taskId: string, runId: string): void {
    this.counts.stalled++;
    this.emit("trace.queue.stalled", runId, { taskId });
  }

  snapshot(): QueueTraceSnapshot {
    return { ...this.counts };
  }

  private emit(eventType: string, runId: string, payload: Record<string, unknown>): void {
    try {
      bus.emit("agent.event", {
        runId, projectId: 0,
        phase: "distributed.telemetry",
        agentName: "queue-trace",
        eventType, payload, ts: Date.now(),
      });
    } catch { /* non-throwing */ }
  }
}

export const queueTrace           = new QueueTrace();
export const distributedQueueTrace = queueTrace; // alias for new API consumers
