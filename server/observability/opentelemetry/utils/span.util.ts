import type { Span, SpanStatus } from "../types.js";

export function computeDuration(startTimeMs: number, endTimeMs: number): number {
  return Math.max(0, endTimeMs - startTimeMs);
}

export function resolveSpanStatus(httpStatusCode?: number): SpanStatus {
  if (httpStatusCode === undefined) return "UNSET";
  if (httpStatusCode >= 500) return "ERROR";
  return "OK";
}

export function isSpanComplete(span: Readonly<Span>): boolean {
  return span.endTimeMs !== undefined;
}

export function hasSpanError(span: Readonly<Span>): boolean {
  return span.status === "ERROR" || span.error !== undefined;
}

export function buildSpanSummary(span: Readonly<Span>): string {
  const duration =
    span.durationMs !== undefined ? `${span.durationMs}ms` : "open";
  const parent = span.parentSpanId ? ` parent=${span.parentSpanId}` : "";
  return `[${span.spanId}] ${span.name} ${duration} status=${span.status}${parent}`;
}
