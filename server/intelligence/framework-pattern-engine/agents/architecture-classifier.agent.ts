import { aggregateFinalScore, clampScore, severityToPenalty } from "../utils/scoring.util.js";
import type { AntiPattern, Pattern } from "../types.js";

export interface ArchitectureClassification {
  readonly architectureType: string;
  readonly maintainabilityScore: number;
}

export function runArchitectureClassifierAgent(
  patterns: readonly Pattern[],
  antiPatterns: readonly AntiPattern[],
): ArchitectureClassification {
  const architectureType = patterns[0]?.name ?? "unknown";

  const patternBoost = patterns.map((pattern) => Math.round(pattern.confidence * 20));
  const antiPatternPenalty = antiPatterns.map((antiPattern) => severityToPenalty(antiPattern.severity));

  const base = 65 + aggregateFinalScore(patternBoost);
  const penalty = antiPatternPenalty.reduce((acc, value) => acc + value, 0);

  return Object.freeze({
    architectureType,
    maintainabilityScore: clampScore(base - penalty),
  });
}
