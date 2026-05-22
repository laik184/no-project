/**
 * confidence-events.ts
 *
 * All confidence event type constants + typed emission helpers.
 * Emits over the infrastructure bus so telemetry/SSE consumers receive updates.
 */

import { bus } from "../../infrastructure/events/bus.ts";
import type {
  AgentConfidenceRecord,
  ConfidenceState,
  ConflictResolutionResult,
  HallucinationSignal,
  ConfidenceRetryDecision,
} from "./confidence-types.ts";

// ── Event type constants ──────────────────────────────────────────────────────

export const CONFIDENCE_EVENTS = {
  UPDATED:              "confidence.updated",
  DEGRADED:             "confidence.degraded",
  BLOCKED:              "confidence.blocked",
  RESTORED:             "confidence.restored",
  RETRY_DENIED:         "confidence.retry.denied",
  RETRY_ALLOWED:        "confidence.retry.allowed",
  CONFLICT_RESOLVED:    "confidence.conflict.resolved",
  HALLUCINATION:        "confidence.hallucination.detected",
  POLICY_VIOLATED:      "confidence.policy.violated",
  STATE_TRANSITION:     "confidence.state.transition",
} as const;

export type ConfidenceEventType = typeof CONFIDENCE_EVENTS[keyof typeof CONFIDENCE_EVENTS];

// ── Typed payload for the bus "agent.event" channel ──────────────────────────

interface ConfidenceEventPayload {
  eventType: ConfidenceEventType;
  data:      unknown;
  ts:        number;
}

function emit(runId: string, agentId: string, eventType: ConfidenceEventType, data: unknown): void {
  const payload: ConfidenceEventPayload = { eventType, data, ts: Date.now() };
  // Re-use the generic agent.event bus channel — kept consistent with the rest of the system
  (bus as any).emit("agent.event", {
    runId,
    agentName:  agentId,
    eventType,
    payload,
    ts: Date.now(),
  });
}

// ── Typed emission helpers ────────────────────────────────────────────────────

export function emitConfidenceUpdated(record: AgentConfidenceRecord): void {
  emit(record.runId, record.agentId, CONFIDENCE_EVENTS.UPDATED, record);
}

export function emitConfidenceDegraded(
  runId: string,
  agentId: string,
  from: ConfidenceState,
  to: ConfidenceState,
  reason: string,
): void {
  emit(runId, agentId, CONFIDENCE_EVENTS.DEGRADED, { agentId, from, to, reason });
}

export function emitConfidenceBlocked(
  runId: string,
  agentId: string,
  reason: string,
): void {
  emit(runId, agentId, CONFIDENCE_EVENTS.BLOCKED, { agentId, reason });
}

export function emitConfidenceRestored(
  runId: string,
  agentId: string,
  from: ConfidenceState,
  newScore: number,
): void {
  emit(runId, agentId, CONFIDENCE_EVENTS.RESTORED, { agentId, from, newScore });
}

export function emitRetryDenied(decision: ConfidenceRetryDecision): void {
  emit(decision.runId, decision.agentId, CONFIDENCE_EVENTS.RETRY_DENIED, decision);
}

export function emitRetryAllowed(decision: ConfidenceRetryDecision): void {
  emit(decision.runId, decision.agentId, CONFIDENCE_EVENTS.RETRY_ALLOWED, decision);
}

export function emitConflictResolved(result: ConflictResolutionResult, runId: string): void {
  emit(runId, result.winnerAgentId, CONFIDENCE_EVENTS.CONFLICT_RESOLVED, result);
}

export function emitHallucinationDetected(
  runId: string,
  agentId: string,
  signal: HallucinationSignal,
): void {
  emit(runId, agentId, CONFIDENCE_EVENTS.HALLUCINATION, { agentId, signal });
}

export function emitPolicyViolated(
  runId: string,
  agentId: string,
  violations: string[],
  penalty: number,
): void {
  emit(runId, agentId, CONFIDENCE_EVENTS.POLICY_VIOLATED, { agentId, violations, penalty });
}

export function emitStateTransition(
  runId: string,
  agentId: string,
  from: ConfidenceState,
  to: ConfidenceState,
): void {
  emit(runId, agentId, CONFIDENCE_EVENTS.STATE_TRANSITION, { agentId, from, to });
}
