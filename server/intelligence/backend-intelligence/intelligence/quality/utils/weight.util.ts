import type { QualityWeights }  from "../types.js";
import { QUALITY_DIMENSIONS } from "../types.js";
import { clamp }              from "./clamp.util.js";

// Equal weight when all provided weights are zero or invalid.
const EQUAL_WEIGHT = 1 / QUALITY_DIMENSIONS.length;

export function normalizeWeights(weights: QualityWeights): QualityWeights {
  const total = QUALITY_DIMENSIONS.reduce((sum, dim) => sum + weights[dim], 0);

  if (total <= 0) {
    return Object.freeze(
      QUALITY_DIMENSIONS.reduce(
        (acc, dim) => ({ ...acc, [dim]: EQUAL_WEIGHT }),
        {} as Record<string, number>,
      ),
    ) as QualityWeights;
  }

  return Object.freeze(
    QUALITY_DIMENSIONS.reduce(
      (acc, dim) => ({ ...acc, [dim]: clamp(weights[dim] / total, 0, 1) }),
      {} as Record<string, number>,
    ),
  ) as QualityWeights;
}
