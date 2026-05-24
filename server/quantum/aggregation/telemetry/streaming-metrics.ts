/**
 * telemetry/streaming-metrics.ts
 *
 * Latency and throughput metrics for streaming aggregation.
 * Records via the orchestration counter/histogram API.
 * Single responsibility: metric recording only.
 */

import { incrementCounter } from "../../../orchestration/telemetry/orchestration-metrics.ts";
import { AGG_METRICS }     from "./aggregation-event-map.ts";

// ── Internal timing registry ──────────────────────────────────────────────────

const _timers = new Map<string, number>();

export function startTimer(key: string): void {
  _timers.set(key, Date.now());
}

export function endTimer(key: string): number {
  const start = _timers.get(key);
  if (start === undefined) return 0;
  _timers.delete(key);
  return Date.now() - start;
}

// ── Metric emitters ───────────────────────────────────────────────────────────

export function recordPartialLatency(durationMs: number, sessionId: string): void {
  incrementCounter(AGG_METRICS.PARTIAL_LATENCY_MS, {
    session: sessionId.slice(0, 8),
    bucket:  _bucket(durationMs),
  });
}

export function recordMergeLatency(durationMs: number, strategy: string): void {
  incrementCounter(AGG_METRICS.MERGE_LATENCY_MS, { strategy, bucket: _bucket(durationMs) });
}

export function recordCollapseLatency(durationMs: number, sessionId: string): void {
  incrementCounter(AGG_METRICS.COLLAPSE_LATENCY_MS, {
    session: sessionId.slice(0, 8),
    bucket:  _bucket(durationMs),
  });
}

export function recordConflictLatency(durationMs: number, strategy: string): void {
  incrementCounter(AGG_METRICS.CONFLICT_LATENCY_MS, { strategy, bucket: _bucket(durationMs) });
}

export function recordReplayLatency(durationMs: number): void {
  incrementCounter(AGG_METRICS.REPLAY_LATENCY_MS, { bucket: _bucket(durationMs) });
}

export function recordVerificationLatency(durationMs: number, phase: string): void {
  incrementCounter(AGG_METRICS.VERIFICATION_LATENCY_MS, { phase, bucket: _bucket(durationMs) });
}

export function recordThroughput(sessionId: string, pathCount: number): void {
  incrementCounter(AGG_METRICS.THROUGHPUT, {
    session: sessionId.slice(0, 8),
    paths:   String(pathCount),
  });
}

export function recordConflictRate(sessionId: string, conflicts: number, total: number): void {
  const rate = total === 0 ? "0" : _bucket(Math.round((conflicts / total) * 100));
  incrementCounter(AGG_METRICS.CONFLICT_RATE, { session: sessionId.slice(0, 8), rate });
}

export function recordSessionCount(delta: 1 | -1): void {
  incrementCounter(AGG_METRICS.SESSION_COUNT, { delta: String(delta) });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _bucket(ms: number): string {
  if (ms <    10) return "<10ms";
  if (ms <    50) return "<50ms";
  if (ms <   100) return "<100ms";
  if (ms <   500) return "<500ms";
  if (ms <  1000) return "<1s";
  if (ms <  5000) return "<5s";
  return ">=5s";
}
