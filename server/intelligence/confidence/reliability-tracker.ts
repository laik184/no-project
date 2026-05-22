/**
 * reliability-tracker.ts
 *
 * Records per-run outcomes and computes updated reliability scores.
 * Writes to reliability-store.ts and updates confidence-store.ts.
 * Emits telemetry on state transitions.
 */

import type { ReliabilityEntry, AgentConfidenceRecord } from "./confidence-types.ts";
import { appendReliabilityEntry, computeReliabilityScore } from "./stores/reliability-store.ts";
import {
  getConfidence,
  updateConfidenceScore,
  getConfidenceState,
} from "./stores/confidence-store.ts";
import { scoreToState } from "./confidence-thresholds.ts";
import {
  emitConfidenceDegraded,
  emitConfidenceRestored,
  emitStateTransition,
} from "./confidence-events.ts";

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Record the outcome of one agent execution and update reliability.
 * Returns the newly computed reliability score.
 */
export function recordOutcome(params: {
  agentId:            string;
  runId:              string;
  success:            boolean;
  verificationPassed: boolean;
  hallucinationRisk:  number;
  retries:            number;
  latencyMs:          number;
}): number {
  const entry: ReliabilityEntry = {
    runId:              params.runId,
    agentId:            params.agentId,
    success:            params.success,
    verificationPassed: params.verificationPassed,
    hallucinationRisk:  params.hallucinationRisk,
    retries:            params.retries,
    latencyMs:          params.latencyMs,
    ts:                 Date.now(),
  };

  appendReliabilityEntry(entry);

  const newReliability = computeReliabilityScore(params.agentId);
  _reconcileStateFromReliability(params.agentId, params.runId, newReliability);

  return newReliability;
}

// ── Internal: state reconciliation ───────────────────────────────────────────

function _reconcileStateFromReliability(
  agentId:        string,
  runId:          string,
  newReliability: number,
): void {
  const existing = getConfidence(agentId);
  if (!existing) return;

  // Blend reliability into the confidence score (30% weight for reliability)
  const blendedScore = existing.confidenceScore * 0.70 + newReliability * 0.30;
  const newState     = scoreToState(blendedScore);
  const oldState     = existing.state;

  updateConfidenceScore(agentId, blendedScore, newState, Date.now());

  if (newState === oldState) return;

  emitStateTransition(runId, agentId, oldState, newState);

  const isDegradation = _stateSeverity(newState) < _stateSeverity(oldState);
  const isRestoration  = _stateSeverity(newState) > _stateSeverity(oldState);

  if (isDegradation) {
    emitConfidenceDegraded(runId, agentId, oldState, newState,
      `Reliability dropped to ${(newReliability * 100).toFixed(1)}%`);
  } else if (isRestoration) {
    emitConfidenceRestored(runId, agentId, oldState, blendedScore);
  }
}

// ── State severity map (higher = better) ─────────────────────────────────────

function _stateSeverity(state: AgentConfidenceRecord["state"]): number {
  const map: Record<AgentConfidenceRecord["state"], number> = {
    TRUSTED:    5,
    STABLE:     4,
    DEGRADED:   3,
    UNRELIABLE: 2,
    BLOCKED:    1,
  };
  return map[state];
}

// ── Utility queries ───────────────────────────────────────────────────────────

export {
  computeReliabilityScore,
  getSuccessRate,
  getVerificationSuccessRate,
  getHallucinationRate,
  getAverageRetries,
  getTotalRuns,
  exportSummaries,
} from "./stores/reliability-store.ts";
