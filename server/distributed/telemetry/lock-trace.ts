/**
 * Responsibility: Distributed lock tracing — records lock acquisition, release,
 *                 contention, deadlock detection, and recovery with span correlation.
 * Dependencies: execution-span, bus
 * Failure: all methods non-throwing; errors logged and swallowed.
 * Telemetry: emits trace.lock.event via bus.
 */

import { executionSpan }  from "./execution-span.ts";
import { bus }            from "../../infrastructure/events/bus.ts";

class LockTrace {
  private readonly activeSpans = new Map<string, string>(); // lockKey → spanId

  onAcquireAttempt(key: string, ownerId: string): string {
    const spanId = executionSpan.start(`lock:acquire:${key}`, ownerId, { key, ownerId });
    this.activeSpans.set(`${key}:${ownerId}`, spanId);
    this.emit("trace.lock.event", ownerId, { event: "acquire_attempt", key, ownerId, spanId });
    return spanId;
  }

  onAcquired(key: string, ownerId: string, backend: string): void {
    const spanId = this.activeSpans.get(`${key}:${ownerId}`);
    if (spanId) executionSpan.end(spanId, "ok");
    this.emit("trace.lock.event", ownerId, { event: "acquired", key, ownerId, backend });
  }

  onReleased(key: string, ownerId: string): void {
    this.emit("trace.lock.event", ownerId, { event: "released", key, ownerId });
  }

  onContention(key: string, ownerId: string, attempt: number): void {
    this.emit("trace.lock.event", ownerId, { event: "contention", key, ownerId, attempt });
  }

  onDeadlock(key: string, owners: string[]): void {
    this.emit("trace.lock.event", "system", { event: "deadlock_risk", key, owners });
  }

  onTimeout(key: string, ownerId: string): void {
    const spanId = this.activeSpans.get(`${key}:${ownerId}`);
    if (spanId) { executionSpan.end(spanId, "error", "lock_timeout"); this.activeSpans.delete(`${key}:${ownerId}`); }
    this.emit("trace.lock.event", ownerId, { event: "timeout", key, ownerId });
  }

  private emit(eventType: string, runId: string, payload: Record<string, unknown>): void {
    try {
      bus.emit("agent.event", {
        runId, projectId: 0,
        phase: "distributed.telemetry",
        agentName: "lock-trace",
        eventType, payload, ts: Date.now(),
      });
    } catch { /* non-throwing */ }
  }
}

export const lockTrace = new LockTrace();
