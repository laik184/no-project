import type { PatternScoreReport } from "../types.js";
import { weightedScore, scoreLevel } from "../utils/score.util.js";

export function calculatePatternScore(input: {
  readonly modularityScore: number;
  readonly couplingScore: number;
  readonly layeringScore: number;
  readonly antiPatternCount: number;
}): PatternScoreReport {
  const antiPatternPenalty = Math.min(40, input.antiPatternCount * 5);

  const score = weightedScore([
    { value: input.modularityScore, weight: 0.35 },
    { value: input.couplingScore, weight: 0.3 },
    { value: input.layeringScore, weight: 0.25 },
    { value: 100 - antiPatternPenalty, weight: 0.1 },
  ]);

  return {
    score,
    level: scoreLevel(score),
  };
}
