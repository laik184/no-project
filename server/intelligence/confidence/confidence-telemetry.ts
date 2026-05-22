/**
 * confidence-telemetry.ts
 *
 * Integrates with the orchestration telemetry layer (counters + spans).
 * All confidence mutations MUST call these helpers — no exceptions.
 * Delegates to orchestration-metrics.ts for counter/histogram tracking.
 */

import { incrementCounter, recordDuration } from "../../orchestration/telemetry/orchestration-metrics.ts";
import type { AgentConfidenceRecord, ConfidenceState, HallucinationSignal } from "./confidence-types.ts";

// ── Label builders ────────────────────────────────────────────────────────────

function agentTags(agentId: string, state?: ConfidenceState): Record<string, string> {
  return state
    ? { agent: agentId, state }
    : { agent: agentId };
}

// ── Counter helpers ───────────────────────────────────────────────────────────

export function telemetryConfidenceScored(record: AgentConfidenceRecord): void {
  incrementCounter("confidence.scored", agentTags(record.agentId, record.state));
  incrementCounter("confidence.outcome", {
    agent:   record.agentId,
    outcome: record.finalOutcome,
  });
}

export function telemetryConfidenceDegraded(
  agentId: string,
  from: ConfidenceState,
  to:   ConfidenceState,
): void {
  incrementCounter("confidence.degraded", { agent: agentId, from, to });
}

export function telemetryConfidenceBlocked(agentId: string, reason: string): void {
  incrementCounter("confidence.blocked", { agent: agentId });
  console.warn(`[confidence-telemetry] BLOCKED agent=${agentId} reason=${reason}`);
}

export function telemetryConfidenceRestored(agentId: string, newScore: number): void {
  incrementCounter("confidence.restored", { agent: agentId });
  console.info(`[confidence-telemetry] RESTORED agent=${agentId} score=${newScore.toFixed(3)}`);
}

export function telemetryRetryDenied(agentId: string, reason: string): void {
  incrementCounter("confidence.retry.denied", { agent: agentId });
  console.info(`[confidence-telemetry] RETRY_DENIED agent=${agentId} reason=${reason}`);
}

export function telemetryRetryAllowed(agentId: string, attempt: number): void {
  incrementCounter("confidence.retry.allowed", { agent: agentId, attempt: String(attempt) });
}

export function telemetryConflictResolved(
  winner: string,
  loser:  string,
  arbitrated: boolean,
): void {
  incrementCounter("confidence.conflict.resolved", {
    winner,
    loser,
    arbitrated: String(arbitrated),
  });
}

export function telemetryHallucinationDetected(
  agentId:  string,
  signal:   HallucinationSignal,
): void {
  incrementCounter("confidence.hallucination.detected", {
    agent:    agentId,
    type:     signal.type,
    severity: signal.severity,
  });
  if (signal.severity === "CRITICAL" || signal.severity === "HIGH") {
    console.warn(
      `[confidence-telemetry] HALLUCINATION agent=${agentId} ` +
      `type=${signal.type} severity=${signal.severity} detail=${signal.detail}`,
    );
  }
}

export function telemetryPolicyViolation(
  agentId:    string,
  violations: string[],
  penalty:    number,
): void {
  incrementCounter("confidence.policy.violated", {
    agent: agentId,
    count: String(violations.length),
  });
  if (penalty > 0.20) {
    console.warn(
      `[confidence-telemetry] POLICY_VIOLATED agent=${agentId} ` +
      `penalty=${penalty.toFixed(3)} violations=${violations.length}`,
    );
  }
}

export function telemetryExecutionDuration(agentId: string, durationMs: number): void {
  recordDuration("confidence.execution_duration_ms", durationMs, { agent: agentId });
}

export function telemetryStateTransition(
  agentId: string,
  from:    ConfidenceState,
  to:      ConfidenceState,
): void {
  incrementCounter("confidence.state.transition", { agent: agentId, from, to });
  console.info(`[confidence-telemetry] STATE_TRANSITION agent=${agentId} ${from} → ${to}`);
}
