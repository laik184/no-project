/**
 * execution-trace.ts
 *
 * Per-path distributed tracing — lightweight span tree for debugging.
 * Stores trace spans in memory; no external dependencies.
 */

import { v4 as uuid } from "uuid";

// ── Span model ────────────────────────────────────────────────────────────────

export interface QuantumSpan {
  spanId:     string;
  pathId:     string;
  parentId?:  string;
  name:       string;
  startedAt:  number;
  endedAt?:   number;
  durationMs?: number;
  status:     "ok" | "error" | "running";
  tags:       Record<string, string | number | boolean>;
  error?:     string;
}

// ── In-memory store ───────────────────────────────────────────────────────────
// pathId → QuantumSpan[]

const _traces = new Map<string, QuantumSpan[]>();

// ── Writers ───────────────────────────────────────────────────────────────────

export function startSpan(
  pathId:   string,
  name:     string,
  tags:     Record<string, string | number | boolean> = {},
  parentId?: string,
): QuantumSpan {
  const span: QuantumSpan = {
    spanId:    uuid(),
    pathId,
    parentId,
    name,
    startedAt: Date.now(),
    status:    "running",
    tags,
  };

  if (!_traces.has(pathId)) _traces.set(pathId, []);
  _traces.get(pathId)!.push(span);
  return span;
}

export function endSpan(
  span:   QuantumSpan,
  status: "ok" | "error" = "ok",
  error?: string,
): QuantumSpan {
  const now      = Date.now();
  const finished = {
    ...span,
    endedAt:    now,
    durationMs: now - span.startedAt,
    status,
    error,
  };

  const list = _traces.get(span.pathId);
  if (list) {
    const idx = list.findIndex(s => s.spanId === span.spanId);
    if (idx >= 0) list[idx] = finished;
  }

  return finished;
}

// ── Readers ───────────────────────────────────────────────────────────────────

export function getTrace(pathId: string): QuantumSpan[] {
  return _traces.get(pathId) ?? [];
}

export function getSpanTree(pathId: string): QuantumSpan[] {
  return (_traces.get(pathId) ?? []).sort((a, b) => a.startedAt - b.startedAt);
}

export function totalDuration(pathId: string): number {
  const spans = _traces.get(pathId) ?? [];
  if (spans.length === 0) return 0;
  const first = Math.min(...spans.map(s => s.startedAt));
  const last  = Math.max(...spans.map(s => s.endedAt ?? s.startedAt));
  return last - first;
}

export function hasErrors(pathId: string): boolean {
  return (_traces.get(pathId) ?? []).some(s => s.status === "error");
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export function clearTrace(pathId: string): void {
  _traces.delete(pathId);
}

export function clearAll(): void {
  _traces.clear();
}
