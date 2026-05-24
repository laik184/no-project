/**
 * telemetry/aggregation-event-map.ts
 *
 * Canonical event name constants for streaming aggregation telemetry.
 * Import this instead of raw strings to prevent typos and drift.
 */

export const AGG_EVENTS = {
  PATH_STARTED:              "path.started",
  PATH_PARTIAL_RESULT:       "path.partial_result",
  PATH_COMPLETED:            "path.completed",
  AGGREGATION_PARTIAL:       "aggregation.partial",
  AGGREGATION_MERGE:         "aggregation.merge",
  AGGREGATION_CONFLICT:      "aggregation.conflict",
  AGGREGATION_RETRY:         "aggregation.retry",
  AGGREGATION_ROLLBACK:      "aggregation.rollback",
  AGGREGATION_COLLAPSE:      "aggregation.collapse",
  AGGREGATION_FAILED:        "aggregation.failed",
  AGGREGATION_SESSION_STARTED: "aggregation.session_started",
  AGGREGATION_SESSION_CLOSED:  "aggregation.session_closed",
  AGGREGATION_CHECKPOINT:    "aggregation.checkpoint",
  AGGREGATION_REPLAY_STARTED:   "aggregation.replay_started",
  AGGREGATION_REPLAY_COMPLETED: "aggregation.replay_completed",
} as const;

export type AggEventKey = keyof typeof AGG_EVENTS;
export type AggEventValue = typeof AGG_EVENTS[AggEventKey];

// ── Metric names ───────────────────────────────────────────────────────────────

export const AGG_METRICS = {
  PARTIAL_LATENCY_MS:      "streaming.aggregation.partial_latency_ms",
  MERGE_LATENCY_MS:        "streaming.aggregation.merge_latency_ms",
  COLLAPSE_LATENCY_MS:     "streaming.aggregation.collapse_latency_ms",
  CONFLICT_LATENCY_MS:     "streaming.aggregation.conflict_latency_ms",
  REPLAY_LATENCY_MS:       "streaming.aggregation.replay_latency_ms",
  VERIFICATION_LATENCY_MS: "streaming.aggregation.verification_latency_ms",
  PATHS_PER_SECOND:        "streaming.aggregation.paths_per_second",
  THROUGHPUT:              "streaming.aggregation.throughput",
  CONFLICT_RATE:           "streaming.aggregation.conflict_rate",
  SESSION_COUNT:           "streaming.aggregation.session_count",
} as const;

export type AggMetricKey = keyof typeof AGG_METRICS;
export type AggMetricValue = typeof AGG_METRICS[AggMetricKey];

// ── Correlation ID builder ─────────────────────────────────────────────────────

export function buildCorrelationId(sessionId: string, eventType: string): string {
  return `${sessionId}:${eventType}:${Date.now()}`;
}
