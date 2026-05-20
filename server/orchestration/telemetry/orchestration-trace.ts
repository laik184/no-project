/**
 * orchestration-trace.ts
 *
 * Distributed tracing for the orchestration layer.
 * Each orchestration run generates a trace with nested spans.
 * Spans are lightweight in-memory structures — no external service required.
 */

import { v4 as uuidv4 } from "uuid";
import type { TraceSpan, SpanEvent } from "../core/orchestration-types.ts";

// ── Span store ────────────────────────────────────────────────────────────────

const _spans = new Map<string, TraceSpan>();         // spanId → span
const _traces = new Map<string, string[]>();          // traceId → spanId[]
const _runTraces = new Map<string, string>();          // runId → traceId

const MAX_SPANS = 2_000;

// ── Span lifecycle ────────────────────────────────────────────────────────────

export function recordSpanStart(
  runId:    string,
  name:     string,
  tags?:    Record<string, string | number | boolean>,
  parentId?: string,
): string {
  // Evict oldest spans if at capacity
  if (_spans.size >= MAX_SPANS) {
    const oldest = _spans.keys().next().value;
    if (oldest) _spans.delete(oldest);
  }

  const spanId  = uuidv4().slice(0, 16);
  const traceId = _runTraces.get(runId) ?? (() => {
    const id = uuidv4();
    _runTraces.set(runId, id);
    return id;
  })();

  const span: TraceSpan = {
    spanId,
    traceId,
    parentId,
    name,
    startedAt: Date.now(),
    status:    "ok",
    tags:      tags ?? {},
    events:    [],
  };

  _spans.set(spanId, span);

  const traceSpans = _traces.get(traceId) ?? [];
  traceSpans.push(spanId);
  _traces.set(traceId, traceSpans);

  return spanId;
}

export function recordSpanEnd(
  spanId: string,
  status: TraceSpan["status"],
): void {
  const span = _spans.get(spanId);
  if (!span) return;

  span.endedAt   = Date.now();
  span.durationMs = span.endedAt - span.startedAt;
  span.status    = status;
}

export function addSpanEvent(
  spanId:  string,
  name:    string,
  payload: Record<string, unknown>,
): void {
  const span = _spans.get(spanId);
  if (!span) return;
  span.events.push({ name, ts: Date.now(), payload });
}

// ── Trace accessors ───────────────────────────────────────────────────────────

export function getSpan(spanId: string): TraceSpan | undefined {
  return _spans.get(spanId);
}

export function getTrace(traceId: string): TraceSpan[] {
  const spanIds = _traces.get(traceId) ?? [];
  return spanIds.map(id => _spans.get(id)!).filter(Boolean);
}

export function getRunTrace(runId: string): TraceSpan[] {
  const traceId = _runTraces.get(runId);
  if (!traceId) return [];
  return getTrace(traceId);
}

export function getTraceId(runId: string): string | undefined {
  return _runTraces.get(runId);
}

// ── Trace summary ─────────────────────────────────────────────────────────────

export interface TraceSummary {
  traceId:    string;
  runId:      string;
  totalSpans: number;
  errors:     number;
  timeouts:   number;
  totalMs:    number;
  spans:      Array<{ name: string; durationMs?: number; status: string }>;
}

export function summarizeTrace(runId: string): TraceSummary | null {
  const traceId = _runTraces.get(runId);
  if (!traceId) return null;

  const spans = getTrace(traceId);
  const root  = spans[0];

  return {
    traceId,
    runId,
    totalSpans: spans.length,
    errors:     spans.filter(s => s.status === "error").length,
    timeouts:   spans.filter(s => s.status === "timeout").length,
    totalMs:    root ? (root.durationMs ?? Date.now() - root.startedAt) : 0,
    spans:      spans.map(s => ({ name: s.name, durationMs: s.durationMs, status: s.status })),
  };
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export function clearTrace(runId: string): void {
  const traceId = _runTraces.get(runId);
  if (traceId) {
    const spanIds = _traces.get(traceId) ?? [];
    spanIds.forEach(id => _spans.delete(id));
    _traces.delete(traceId);
  }
  _runTraces.delete(runId);
}

export function traceStats(): { spans: number; traces: number } {
  return { spans: _spans.size, traces: _traces.size };
}
