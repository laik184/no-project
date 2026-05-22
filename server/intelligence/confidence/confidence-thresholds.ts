/**
 * confidence-thresholds.ts
 *
 * All numeric thresholds and weights for the confidence system.
 * Single place to tune — no magic numbers scattered across modules.
 */

import type { ConfidenceState } from "./confidence-types.ts";

// ── State boundary thresholds ────────────────────────────────────────────────

export const STATE_THRESHOLDS: Record<ConfidenceState, number> = {
  TRUSTED:    0.85,
  STABLE:     0.65,
  DEGRADED:   0.40,
  UNRELIABLE: 0.20,
  BLOCKED:    0.00,
} as const;

export function scoreToState(score: number): ConfidenceState {
  if (score >= STATE_THRESHOLDS.TRUSTED)    return "TRUSTED";
  if (score >= STATE_THRESHOLDS.STABLE)     return "STABLE";
  if (score >= STATE_THRESHOLDS.DEGRADED)   return "DEGRADED";
  if (score >= STATE_THRESHOLDS.UNRELIABLE) return "UNRELIABLE";
  return "BLOCKED";
}

// ── Scoring weights (must sum to 1.0) ────────────────────────────────────────

export const SCORING_WEIGHTS = {
  verificationSuccess:    0.30,
  runtimeStability:       0.20,
  hallucinationPenalty:   0.20,  // subtracted
  executionQuality:       0.15,
  historicalReliability:  0.10,
  latency:                0.05,
} as const;

// ── Hallucination thresholds ──────────────────────────────────────────────────

export const HALLUCINATION = {
  HARD_BLOCK_THRESHOLD: 0.90,   // immediate BLOCKED state
  DEGRADED_THRESHOLD:   0.60,   // force DEGRADED
  WARNING_THRESHOLD:    0.40,   // emit warning telemetry
  PENALTY_BY_SEVERITY: {
    LOW:      0.05,
    MEDIUM:   0.15,
    HIGH:     0.30,
    CRITICAL: 0.50,
  },
} as const;

// ── Retry intelligence limits ─────────────────────────────────────────────────

export const RETRY = {
  MAX_FOR_TRUSTED:    5,
  MAX_FOR_STABLE:     3,
  MAX_FOR_DEGRADED:   2,
  MAX_FOR_UNRELIABLE: 1,
  MAX_FOR_BLOCKED:    0,
  BASE_BACKOFF_MS:    2_000,
  MAX_BACKOFF_MS:     30_000,
  SAME_FAILURE_BLOCK: 3,   // block after N identical failure types
} as const;

// ── Reliability EWMA decay ────────────────────────────────────────────────────

export const RELIABILITY = {
  EWMA_ALPHA:           0.30,   // weight for newest observation
  MIN_SAMPLES_FOR_EWMA: 3,      // fall back to raw average below this
  INITIAL_SCORE:        0.70,   // optimistic prior for new agents
} as const;

// ── Execution quality weights ─────────────────────────────────────────────────

export const QUALITY_WEIGHTS = {
  verificationSuccess: 0.40,
  runtimeStability:    0.25,
  codeQuality:         0.20,
  policyCompliance:    0.10,
  modularity:          0.05,
} as const;

// ── Latency scoring curve (ms → score 0–1) ────────────────────────────────────

export const LATENCY = {
  EXCELLENT_MS: 5_000,    // 1.0 score
  GOOD_MS:      15_000,   // 0.75 score
  ACCEPTABLE_MS: 30_000,  // 0.50 score
  POOR_MS:       60_000,  // 0.25 score
} as const;

export function latencyToScore(ms: number): number {
  if (ms <= LATENCY.EXCELLENT_MS)  return 1.0;
  if (ms <= LATENCY.GOOD_MS)       return 0.75;
  if (ms <= LATENCY.ACCEPTABLE_MS) return 0.50;
  if (ms <= LATENCY.POOR_MS)       return 0.25;
  return 0.10;
}

// ── Policy violation penalties ────────────────────────────────────────────────

export const POLICY = {
  PENALTY_PER_VIOLATION: 0.05,
  MAX_TOTAL_PENALTY:     0.40,
  BLOCK_AFTER_VIOLATIONS: 8,
} as const;

// ── Confidence persistence TTL ────────────────────────────────────────────────

export const STORAGE = {
  MAX_HISTORY_ENTRIES_PER_AGENT: 100,
  CONFIDENCE_TTL_MS:             7 * 24 * 60 * 60 * 1_000,  // 7 days
} as const;
