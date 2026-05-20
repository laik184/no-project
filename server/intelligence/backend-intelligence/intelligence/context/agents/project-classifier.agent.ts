import type { NormalizedSignals, ProjectContext } from "../types.js";
import { pickProjectSize, pickProjectType } from "../utils/project-map.util.js";

// ── Complexity weights (must sum to 1.0) ──────────────────────────────────────

const WEIGHT_ENDPOINT   = 0.40;
const WEIGHT_MODULE     = 0.25;
const WEIGHT_SERVICE    = 0.20;
const WEIGHT_DEPENDENCY = 0.15;

const COMPLEXITY_MAX = 100;

function calculateComplexity(signals: NormalizedSignals): number {
  const weighted =
    signals.endpointCount       * WEIGHT_ENDPOINT   +
    signals.moduleCount         * WEIGHT_MODULE     +
    signals.serviceCount        * WEIGHT_SERVICE    +
    signals.dependencies.length * WEIGHT_DEPENDENCY;

  return Math.min(COMPLEXITY_MAX, Math.round(weighted));
}

export function classifyProject(signals: NormalizedSignals): ProjectContext {
  return Object.freeze({
    type:       pickProjectType(signals),
    size:       pickProjectSize(signals),
    complexity: calculateComplexity(signals),
  });
}
