import type { QualityWeights } from "../types.js";
import { normalizeWeights } from "../utils/weight.util.js";

const DEFAULT_WEIGHTS: QualityWeights = Object.freeze({
  architecture: 0.25,
  security: 0.25,
  performance: 0.2,
  codeQuality: 0.15,
  risk: 0.15,
});

export function resolveQualityWeights(): QualityWeights {
  return normalizeWeights(DEFAULT_WEIGHTS);
}
