/**
 * reroute-telemetry.ts
 *
 * All telemetry emissions for the Dynamic Re-Routing System.
 * Integrates with infrastructure bus + orchestration metrics.
 * Every reroute event MUST be emitted here — no direct bus calls elsewhere.
 */

import { bus }                  from "../../infrastructure/events/bus.ts";
import { incrementCounter, recordDuration } from "../telemetry/orchestration-metrics.ts";
import type {
  RerouteSignal,
  RerouteDecision,
  ModeTransitionRecord,
  RuntimeMetricsSnapshot,
} from "./reroute-types.ts";

// ── Event type constants ──────────────────────────────────────────────────────

export const REROUTE_EVENTS = {
  SIGNAL_DETECTED:        "reroute.signal.detected",
  REQUESTED:              "reroute.requested",
  APPROVED:               "reroute.approved",
  BLOCKED:                "reroute.blocked",
  TRANSITION_STARTED:     "reroute.transition.started",
  TRANSITION_COMPLETED:   "reroute.transition.completed",
  TRANSITION_FAILED:      "reroute.transition.failed",
  LOOP_DETECTED:          "reroute.loop.detected",
} as const;

// ── Internal emit ─────────────────────────────────────────────────────────────

function emit(runId: string, eventType: string, payload: unknown): void {
  (bus as any).emit("agent.event", {
    runId,
    agentName: "dynamic-rerouter",
    eventType,
    payload,
    ts: Date.now(),
  });
}

// ── Signal telemetry ──────────────────────────────────────────────────────────

export function telemetrySignalDetected(
  signal: RerouteSignal,
  runId:  string,
): void {
  incrementCounter("reroute.signals.detected", { kind: signal.kind });
  emit(runId, REROUTE_EVENTS.SIGNAL_DETECTED, {
    kind:      signal.kind,
    strength:  signal.strength,
    value:     signal.value,
    threshold: signal.threshold,
    detail:    signal.detail,
  });
}

// ── Decision telemetry ────────────────────────────────────────────────────────

export function telemetryRerouteRequested(
  decision: RerouteDecision,
  runId:    string,
  metrics:  RuntimeMetricsSnapshot,
): void {
  incrementCounter("reroute.requested", { fromMode: decision.fromMode });
  emit(runId, REROUTE_EVENTS.REQUESTED, {
    fromMode:      decision.fromMode,
    toMode:        decision.toMode,
    confidence:    decision.confidence,
    urgency:       decision.urgency,
    triggerSignals: decision.triggerSignals,
    reason:        decision.reason,
    retryCount:    metrics.retryCount,
    filesTouched:  metrics.filesTouchedCount,
    verificationFails: metrics.verificationFailCount,
    elapsedMs:     metrics.elapsedMs,
    currentPhase:  metrics.currentPhase,
  });
}

export function telemetryRerouteApproved(
  decision: RerouteDecision,
  runId:    string,
): void {
  incrementCounter("reroute.approved", {
    fromMode: decision.fromMode,
    toMode:   decision.toMode ?? "none",
  });
  emit(runId, REROUTE_EVENTS.APPROVED, {
    fromMode: decision.fromMode,
    toMode:   decision.toMode,
    confidence: decision.confidence,
  });
}

export function telemetryRerouteBlocked(
  runId:          string,
  fromMode:       string,
  blockingGuards: string[],
  reason:         string,
): void {
  incrementCounter("reroute.blocked", { fromMode });
  emit(runId, REROUTE_EVENTS.BLOCKED, { fromMode, blockingGuards, reason });
}

export function telemetryLoopDetected(runId: string, escalationCount: number): void {
  incrementCounter("reroute.loop.detected");
  emit(runId, REROUTE_EVENTS.LOOP_DETECTED, { escalationCount });
  console.warn(`[reroute-telemetry] Loop detected run=${runId} escalations=${escalationCount}`);
}

// ── Transition telemetry ──────────────────────────────────────────────────────

export function telemetryTransitionStarted(rec: ModeTransitionRecord): void {
  incrementCounter("reroute.transition.started", {
    from: rec.fromMode, to: rec.toMode,
  });
  emit(rec.runId, REROUTE_EVENTS.TRANSITION_STARTED, {
    transitionId: rec.transitionId,
    fromMode:     rec.fromMode,
    toMode:       rec.toMode,
    reason:       rec.reason,
  });
}

export function telemetryTransitionCompleted(rec: ModeTransitionRecord): void {
  incrementCounter("reroute.transition.completed", {
    from: rec.fromMode, to: rec.toMode,
  });
  if (rec.durationMs !== undefined) {
    recordDuration("reroute.transition.duration_ms", rec.durationMs, {
      from: rec.fromMode, to: rec.toMode,
    });
  }
  emit(rec.runId, REROUTE_EVENTS.TRANSITION_COMPLETED, {
    transitionId: rec.transitionId,
    fromMode:     rec.fromMode,
    toMode:       rec.toMode,
    durationMs:   rec.durationMs,
    checkpointId: rec.checkpointId,
  });
}

export function telemetryTransitionFailed(rec: ModeTransitionRecord, error: string): void {
  incrementCounter("reroute.transition.failed", { from: rec.fromMode, to: rec.toMode });
  emit(rec.runId, REROUTE_EVENTS.TRANSITION_FAILED, {
    transitionId: rec.transitionId,
    fromMode:     rec.fromMode,
    toMode:       rec.toMode,
    error,
  });
}
