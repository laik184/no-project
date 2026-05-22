/**
 * confidence-scorer.ts
 *
 * Pure scoring function — takes a ScoringInput and returns a [0,1] score.
 * No side effects. No bus emissions. No store mutations.
 * Called by confidence-engine.ts after all inputs are assembled.
 */

import type { ScoringInput, ExecutionQualityDimensions } from "./confidence-types.ts";
import {
  SCORING_WEIGHTS,
  QUALITY_WEIGHTS,
  latencyToScore,
  POLICY,
} from "./confidence-thresholds.ts";

// ── Quality composite score ───────────────────────────────────────────────────

function computeQualityComposite(dims: ExecutionQualityDimensions): number {
  return (
    dims.verificationSuccess * QUALITY_WEIGHTS.verificationSuccess +
    dims.runtimeStability    * QUALITY_WEIGHTS.runtimeStability    +
    dims.codeQuality         * QUALITY_WEIGHTS.codeQuality         +
    dims.policyCompliance    * QUALITY_WEIGHTS.policyCompliance    +
    dims.modularity          * QUALITY_WEIGHTS.modularity
  );
}

// ── Runtime stability score (inverse of failures+retries) ────────────────────

function computeRuntimeStability(runtimeFailures: number, retries: number): number {
  const failurePenalty = Math.min(runtimeFailures * 0.15, 0.60);
  const retryPenalty   = Math.min(retries        * 0.05, 0.25);
  return Math.max(0, 1 - failurePenalty - retryPenalty);
}

// ── Policy violation penalty (capped) ────────────────────────────────────────

function computePolicyPenalty(violations: number): number {
  return Math.min(violations * POLICY.PENALTY_PER_VIOLATION, POLICY.MAX_TOTAL_PENALTY);
}

// ── Main scoring function ─────────────────────────────────────────────────────

export interface ScoringResult {
  confidenceScore:  number;
  breakdown: {
    verificationFactor:   number;
    runtimeFactor:        number;
    hallucinationPenalty: number;
    qualityFactor:        number;
    reliabilityFactor:    number;
    latencyFactor:        number;
    policyPenalty:        number;
  };
}

export function scoreExecution(input: ScoringInput): ScoringResult {
  const verificationFactor   = input.verificationPassed ? 1.0 : 0.0;
  const runtimeFactor        = computeRuntimeStability(input.runtimeFailures, input.retries);
  const hallucinationPenalty = Math.min(input.hallucinationRisk, 1.0);
  const qualityFactor        = computeQualityComposite(input.executionQuality);
  const reliabilityFactor    = Math.min(input.historicalReliability, 1.0);
  const latencyFactor        = latencyToScore(input.latencyMs);
  const policyPenalty        = computePolicyPenalty(input.policyViolations);

  // Weighted sum
  let raw =
    verificationFactor  * SCORING_WEIGHTS.verificationSuccess   +
    runtimeFactor       * SCORING_WEIGHTS.runtimeStability      +
    qualityFactor       * SCORING_WEIGHTS.executionQuality      +
    reliabilityFactor   * SCORING_WEIGHTS.historicalReliability +
    latencyFactor       * SCORING_WEIGHTS.latency;

  // Subtractive penalties (hallucination + policy)
  raw -= hallucinationPenalty * SCORING_WEIGHTS.hallucinationPenalty;
  raw -= policyPenalty;

  const confidenceScore = Math.max(0, Math.min(1, raw));

  return {
    confidenceScore,
    breakdown: {
      verificationFactor,
      runtimeFactor,
      hallucinationPenalty,
      qualityFactor,
      reliabilityFactor,
      latencyFactor,
      policyPenalty,
    },
  };
}

// ── Conflict comparison ───────────────────────────────────────────────────────

/**
 * Deterministically compare two agents for conflict resolution.
 * Returns positive if agentA should win, negative if agentB should win.
 */
export function compareForConflict(
  scoreA: number, hallucinationA: number, verificationA: boolean,
  scoreB: number, hallucinationB: number, verificationB: boolean,
): number {
  // Verification pass is a hard gate — always prefer the verified agent
  if (verificationA && !verificationB) return  1;
  if (!verificationA && verificationB) return -1;

  // Lower hallucination risk is strongly preferred
  const hallucinationDiff = hallucinationB - hallucinationA;
  if (Math.abs(hallucinationDiff) > 0.10) return hallucinationDiff;

  // Finally, compare raw confidence scores
  return scoreA - scoreB;
}
