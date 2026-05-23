/**
 * Responsibility: Distributed retry tracing — records retry attempts, backoff
 *                 delays, exhaustion events, and dead-letter routing across all layers.
 * Dependencies: bus
 * Failure: all methods non-throwing; errors logged and swallowed.
 * Telemetry: emits trace.retry.event via bus.
 */

import { bus } from "../../infrastructure/events/bus.ts";

interface RetryMetrics {
  totalAttempts: number;
  exhausted:     number;
  succeeded:     number;
  deadLettered:  number;
}

class RetryTrace {
  private readonly m: RetryMetrics = { totalAttempts: 0, exhausted: 0, succeeded: 0, deadLettered: 0 };

  onRetryScheduled(taskId: string, runId: string, attempt: number, delayMs: number, layer: string): void {
    this.m.totalAttempts++;
    this.emit("trace.retry.event", runId, { event: "scheduled", taskId, attempt, delayMs, layer });
  }

  onRetrySucceeded(taskId: string, runId: string, attempt: number, layer: string): void {
    this.m.succeeded++;
    this.emit("trace.retry.event", runId, { event: "succeeded", taskId, attempt, layer });
  }

  onRetryExhausted(taskId: string, runId: string, maxAttempts: number, layer: string): void {
    this.m.exhausted++;
    this.emit("trace.retry.event", runId, { event: "exhausted", taskId, maxAttempts, layer });
  }

  onDeadLettered(taskId: string, runId: string, reason: string): void {
    this.m.deadLettered++;
    this.emit("trace.retry.event", runId, { event: "dead_lettered", taskId, reason });
  }

  snapshot(): RetryMetrics { return { ...this.m }; }

  private emit(eventType: string, runId: string, payload: Record<string, unknown>): void {
    try {
      bus.emit("agent.event", {
        runId, projectId: 0,
        phase: "distributed.telemetry",
        agentName: "retry-trace",
        eventType, payload, ts: Date.now(),
      });
    } catch { /* non-throwing */ }
  }
}

export const retryTrace = new RetryTrace();
