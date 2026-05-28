/**
 * server/orchestration/telemetry/metrics.ts
 *
 * Lightweight in-process metrics surface: counters, spans, durations.
 * In production this can be wired to an OTLP exporter; here it logs to console
 * and accumulates in-memory for observability endpoints.
 * Orchestration-only — no tool execution, no filesystem access.
 */

// ── In-memory accumulator (singleton, reset on process restart) ────────────────

const _counters  = new Map<string, number>();
const _durations = new Map<string, number[]>();
const _spans     = new Map<string, { start: number; events: string[] }>();

// ── Counter ───────────────────────────────────────────────────────────────────

export function incrementCounter(
  name:   string,
  labels: Record<string, string> = {},
  by = 1,
): void {
  const key = buildKey(name, labels);
  _counters.set(key, (_counters.get(key) ?? 0) + by);
}

export function getCounter(name: string, labels: Record<string, string> = {}): number {
  return _counters.get(buildKey(name, labels)) ?? 0;
}

// ── Duration / histogram ──────────────────────────────────────────────────────

export function recordDuration(
  name:     string,
  ms:       number,
  labels:   Record<string, string> = {},
): void {
  const key  = buildKey(name, labels);
  const list = _durations.get(key) ?? [];
  list.push(ms);
  _durations.set(key, list);
}

// ── Span tracing ──────────────────────────────────────────────────────────────

export function recordSpanStart(spanId: string): void {
  _spans.set(spanId, { start: Date.now(), events: [] });
}

export function addSpanEvent(spanId: string, event: string): void {
  _spans.get(spanId)?.events.push(event);
}

export function recordSpanEnd(spanId: string): number | undefined {
  const span = _spans.get(spanId);
  if (!span) return undefined;
  const durationMs = Date.now() - span.start;
  _spans.delete(spanId);
  return durationMs;
}

// ── metricsCollector facade (per-run) ─────────────────────────────────────────

class MetricsCollector {
  timing(runId: string, name: string, ms: number): void {
    recordDuration(`${name}`, ms, { runId });
  }

  increment(runId: string, name: string, count = 1): void {
    incrementCounter(name, { runId }, count);
  }
}

export const metricsCollector = new MetricsCollector();

// ── Snapshot ──────────────────────────────────────────────────────────────────

export function metricsSnapshot(): {
  counters:  Record<string, number>;
  durations: Record<string, number[]>;
} {
  return {
    counters:  Object.fromEntries(_counters),
    durations: Object.fromEntries(_durations),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildKey(name: string, labels: Record<string, string>): string {
  const parts = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(',');
  return parts ? `${name}{${parts}}` : name;
}
