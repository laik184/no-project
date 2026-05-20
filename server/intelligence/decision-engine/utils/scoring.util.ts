import { clamp } from './normalization.util.ts';

export interface ScoringWeights {
  confidence: number;
  capability: number;
  risk: number;
  complexity: number;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  confidence: 0.35,
  capability: 0.30,
  risk: 0.25,
  complexity: 0.10,
};

export function weightedScore(
  confidenceScore: number,
  capabilityScore: number,
  riskPenalty: number,
  complexityPenalty: number,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
): number {
  const raw =
    weights.confidence * confidenceScore +
    weights.capability * capabilityScore -
    weights.risk * riskPenalty -
    weights.complexity * complexityPenalty;
  return clamp(raw, 0, 1);
}

export function capabilityScore(matched: number, total: number): number {
  if (total === 0) return 0;
  return clamp(matched / total, 0, 1);
}

export function riskPenalty(failureProbability: number, securityRisk: number, performanceRisk: number): number {
  return clamp((failureProbability * 0.5 + securityRisk * 0.3 + performanceRisk * 0.2), 0, 1);
}

export function complexityPenalty(estimatedSteps: number): number {
  if (estimatedSteps <= 2) return 0.0;
  if (estimatedSteps <= 5) return 0.2;
  if (estimatedSteps <= 10) return 0.4;
  return 0.6;
}

export function aggregateScores(scores: number[]): number {
  if (scores.length === 0) return 0;
  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}
