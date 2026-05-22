/**
 * Responsibility: Core distributed tracing primitives — span creation, lock events,
 *                 conflict events, and consensus events for the distributed layer.
 * Dependencies: bus
 * Failure: all methods are non-throwing; errors are logged and swallowed.
 * Telemetry: this IS the telemetry module — emits to bus for downstream consumers.
 */

import { bus } from "../../infrastructure/events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DistributedSpan {
  id:        string;
  name:      string;
  runId:     string;
  startedAt: number;
  tags:      Record<string, string>;
}

// ── Trace ────────────────────────────────────────────────────────────────────

class DistributedTrace {
  private readonly spans = new Map<string, DistributedSpan>();
  private seq = 0;

  // ── Spans ──────────────────────────────────────────────────────────────────

  startSpan(runId: string, name: string, tags: Record<string, string> = {}): string {
    const id = `dspan-${++this.seq}-${Date.now()}`;
    this.spans.set(id, { id, name, runId, startedAt: Date.now(), tags });
    return id;
  }

  endSpan(spanId: string, status: "ok" | "error" = "ok"): void {
    const span = this.spans.get(spanId);
    if (!span) return;
    this.spans.delete(spanId);

    bus.emit("agent.event", {
      runId:     span.runId,
      projectId: 0,
      phase:     "distributed.trace",
      agentName: "distributed-trace",
      eventType: status === "ok" ? "agent.completed" : "agent.failed",
      payload:   { spanId, name: span.name, durationMs: Date.now() - span.startedAt, tags: span.tags },
      ts:        Date.now(),
    });
  }

  // ── Lock events ────────────────────────────────────────────────────────────

  lockAcquired(key: string, ownerId: string): void {
    this.emit("lock.acquired", ownerId, { key, ownerId });
  }

  lockReleased(key: string, ownerId: string): void {
    this.emit("lock.released", ownerId, { key, ownerId });
  }

  // ── Sync events ────────────────────────────────────────────────────────────

  syncWait(barrier: string, workerId: string): void {
    this.emit("sync.wait", workerId, { barrier, workerId });
  }

  // ── Conflict events ────────────────────────────────────────────────────────

  distributedConflict(runId: string, path: string, owners: string[]): void {
    this.emit("distributed.conflict", runId, { path, owners });
  }

  distributedConsensus(runId: string, outcome: string, confidence: number): void {
    this.emit("distributed.consensus", runId, { outcome, confidence });
  }

  // ── Recovery events ────────────────────────────────────────────────────────

  distributedRecovery(runId: string, subject: string, reason: string): void {
    this.emit("distributed.recovery", runId, { subject, reason });
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  activeSpans(): number {
    return this.spans.size;
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private emit(eventType: string, runId: string, payload: Record<string, unknown>): void {
    try {
      bus.emit("agent.event", {
        runId,
        projectId: 0,
        phase:     "distributed.trace",
        agentName: "distributed-trace",
        eventType,
        payload,
        ts: Date.now(),
      });
    } catch (err) {
      console.error("[distributed-trace] Emit error:", err);
    }
  }
}

export const distributedTrace = new DistributedTrace();
