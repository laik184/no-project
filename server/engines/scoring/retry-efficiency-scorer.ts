/**
 * server/engines/scoring/retry-efficiency-scorer.ts
 * Scores execution efficiency based on step count and verification retries.
 * Single responsibility: compute RetryEfficiencyScore. No side effects.
 */

import type { RetryEfficiencyScore } from "./types.ts";

const IDEAL_STEPS         = 8;
const MAX_STEPS           = 25;
const RETRY_PENALTY       = 12; // points per verification retry

function labelFromScore(score: number): RetryEfficiencyScore["label"] {
  if (score >= 85) return "excellent";
  if (score >= 65) return "good";
  if (score >= 45) return "fair";
  return "poor";
}

export function scoreRetryEfficiency(
  totalSteps:         number,
  verificationRetries: number,
): RetryEfficiencyScore {
  // Step penalty: linear degradation from IDEAL_STEPS to MAX_STEPS
  const stepRatio   = Math.min(totalSteps, MAX_STEPS) / MAX_STEPS;
  const baseScore   = Math.round((1 - stepRatio) * 100 + (IDEAL_STEPS / MAX_STEPS) * 100) / 2;
  const penalty     = verificationRetries * RETRY_PENALTY;
  const score       = Math.max(0, Math.min(100, Math.round(baseScore - penalty)));

  return {
    score,
    totalSteps,
    verificationRetries,
    penalty,
    label: labelFromScore(score),
  };
}
