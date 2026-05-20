import type { QualityBreakdown, QualityDimension, QualityWeights, WeightedDimension } from "../types.js";
import { QUALITY_DIMENSIONS } from "../types.js";
import { clamp }              from "../utils/clamp.util.js";

function buildWeightedDimension(
  dimension: QualityDimension,
  score:     number,
  weight:    number,
): WeightedDimension {
  return Object.freeze({
    dimension,
    score,
    weight,
    weightedScore: score * weight,
  });
}

export function aggregateWeightedScore(
  breakdown: QualityBreakdown,
  weights:   QualityWeights,
): number {
  const dimensions: readonly WeightedDimension[] = Object.freeze(
    QUALITY_DIMENSIONS.map((dim) => buildWeightedDimension(dim, breakdown[dim], weights[dim])),
  );

  const score = dimensions.reduce((total, dim) => total + dim.weightedScore, 0);

  return clamp(Number(score.toFixed(2)), 0, 100);
}
