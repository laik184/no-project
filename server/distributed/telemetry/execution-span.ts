/**
 * Responsibility: Distributed execution span tracking — creates, updates, and
 *                 finalizes spans for all distributed operations.
 * Dependencies: bus, correlation-id
 * Failure: all operations non-throwing; span errors logged and swallowed.
 * Telemetry: emits trace.span.started and trace.span.ended on every span lifecycle.
 */

import { bus }                from "../../infrastructure/events/bus.ts";
import { correlationIdManager } from "./correlation-id.ts";
import type { ExecutionSpan, SpanStatus } from "./types/index.ts";

class ExecutionSpanTracker {
  private readonly spans = new Map<string, ExecutionSpan>();
  private seq = 0;

  start(
    name:   string,
    runId:  string,
    tags:   Record<string, string> = {},
    parentSpanId?: string,
  ): string {
    const ctx   = correlationIdManager.create(runId, name, tags);
    const span: ExecutionSpan = {
      spanId:    ctx.spanId,
      traceId:   ctx.traceId,
      name,
      runId,
      startedAt: ctx.startedAt,
      status:    "running",
      tags,
      children:  [],
    };

    if (parentSpanId) {
      const parent = [...this.spans.values()].find(s => s.spanId === parentSpanId);
      if (parent) parent.children.push(span.spanId);
    }

    this.spans.set(span.spanId, span);
    this.emit("trace.span.started", runId, { spanId: span.spanId, traceId: span.traceId, name, tags });
    return span.spanId;
  }

  end(spanId: string, status: SpanStatus = "ok", error?: string): void {
    const span = this.spans.get(spanId);
    if (!span) return;
    span.endedAt   = Date.now();
    span.durationMs = span.endedAt - span.startedAt;
    span.status    = status;
    if (error) span.error = error;

    this.emit("trace.span.ended", span.runId, {
      spanId, traceId: span.traceId, name: span.name,
      status, durationMs: span.durationMs, error,
    });
    this.spans.delete(spanId);
  }

  get(spanId: string): ExecutionSpan | undefined {
    return this.spans.get(spanId);
  }

  activeCount(): number { return this.spans.size; }

  private emit(eventType: string, runId: string, payload: Record<string, unknown>): void {
    try {
      bus.emit("agent.event", {
        runId, projectId: 0,
        phase: "distributed.telemetry",
        agentName: "execution-span",
        eventType, payload, ts: Date.now(),
      });
    } catch { /* non-throwing */ }
  }
}

export const executionSpan = new ExecutionSpanTracker();
