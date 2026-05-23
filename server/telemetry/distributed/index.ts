/**
 * server/telemetry/distributed/index.ts
 *
 * Unified telemetry facade for distributed execution (Phase 9).
 *
 * Provides:
 *   • Correlation ID lifecycle management
 *   • Execution span tracing (start / end / error)
 *   • Runtime coordination metrics
 *   • Queue metrics aggregation
 *   • Retry metrics
 *   • Deterministic execution tracing
 *
 * All telemetry is currently in-process (EventBus), but the interface
 * is designed to be wire-compatible with OpenTelemetry spans.
 */

import { bus } from "../../infrastructure/events/bus.ts";
import { v4 as uuidv4 } from "uuid";

// ── Execution span tracing ────────────────────────────────────────────────────

export interface ExecutionSpan {
  spanId:        string;
  traceId:       string;
  correlationId: string;
  name:          string;
  startedAt:     number;
  endedAt?:      number;
  durationMs?:   number;
  status:        "started" | "completed" | "failed";
  attributes:    Record<string, unknown>;
}

const _activeSpans = new Map<string, ExecutionSpan>();

export function startSpan(params: {
  name:          string;
  correlationId: string;
  traceId?:      string;
  attributes?:   Record<string, unknown>;
}): ExecutionSpan {
  const span: ExecutionSpan = {
    spanId:        uuidv4(),
    traceId:       params.traceId ?? uuidv4(),
    correlationId: params.correlationId,
    name:          params.name,
    startedAt:     Date.now(),
    status:        "started",
    attributes:    params.attributes ?? {},
  };
  _activeSpans.set(span.spanId, span);
  return span;
}

export function endSpan(spanId: string, error?: string): ExecutionSpan | null {
  const span = _activeSpans.get(spanId);
  if (!span) return null;

  span.endedAt   = Date.now();
  span.durationMs = span.endedAt - span.startedAt;
  span.status    = error ? "failed" : "completed";
  _activeSpans.delete(spanId);
  return span;
}

// ── Runtime coordination metrics ──────────────────────────────────────────────

export function emitRuntimeCoordinationMetric(params: {
  runId:          string;
  correlationId:  string;
  metric:         string;
  value:          number;
  unit:           "ms" | "count" | "ratio" | "bytes";
  tags?:          Record<string, string>;
}): void {
  bus.emit("agent.event", {
    runId:     params.runId,
    eventType: "runtime.metric" as any,
    phase:     "distributed-telemetry",
    ts:        Date.now(),
    payload:   {
      correlationId: params.correlationId,
      metric:        params.metric,
      value:         params.value,
      unit:          params.unit,
      tags:          params.tags ?? {},
    },
  });
}

// ── Queue metrics ─────────────────────────────────────────────────────────────

export function emitQueueMetric(params: {
  runId:        string;
  queueName:    string;
  depth:        number;
  throughput:   number;   // tasks/sec
  errorRate:    number;   // 0–1
  p50LatencyMs: number;
  p99LatencyMs: number;
}): void {
  bus.emit("agent.event", {
    runId:     params.runId,
    eventType: "queue.metrics" as any,
    phase:     "distributed-telemetry",
    ts:        Date.now(),
    payload:   params,
  });
}

// ── Retry metrics ─────────────────────────────────────────────────────────────

export function emitRetryMetric(params: {
  runId:       string;
  taskId:      string;
  taskType:    string;
  attempt:     number;
  maxAttempts: number;
  delayMs:     number;
  reason:      string;
}): void {
  bus.emit("agent.event", {
    runId:     params.runId,
    eventType: "retry.metric" as any,
    phase:     "distributed-telemetry",
    ts:        Date.now(),
    payload:   params,
  });
}

// ── Deterministic execution trace ─────────────────────────────────────────────

/**
 * Records that a set of tasks were dispatched in a deterministic order.
 * Used to verify replay consistency.
 */
export function emitDeterministicDispatch(params: {
  runId:      string;
  waveId:     string;
  taskIds:    string[];
  orderHash:  string;   // SHA-256 of sorted taskIds — for replay validation
}): void {
  bus.emit("agent.event", {
    runId:     params.runId,
    eventType: "execution.deterministic.dispatch" as any,
    phase:     "distributed-telemetry",
    ts:        Date.now(),
    payload:   params,
  });
}

// ── Aggregation trace ID ──────────────────────────────────────────────────────

/**
 * Builds an aggregation trace ID for a wave's result collapse.
 * Format: {runId}:agg:{waveIndex}
 */
export function buildAggregationTraceId(runId: string, waveIndex: number): string {
  return `${runId}:agg:${waveIndex}`;
}
