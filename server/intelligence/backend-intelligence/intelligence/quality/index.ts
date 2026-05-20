// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  QualityDimension,
  QualityGrade,
  QualityInput,
  QualityBreakdown,
  QualityWeights,
  WeightedDimension,
  QualityReport,
} from "./types.js";

// ── Canonical enumeration ─────────────────────────────────────────────────────
export { QUALITY_DIMENSIONS } from "./types.js";

// ── State management ──────────────────────────────────────────────────────────
export type { QualityState } from "./state.js";
export {
  createInitialQualityState,
  recordQualityScore,
} from "./state.js";

// ── Orchestrator ──────────────────────────────────────────────────────────────
export { runQualityEngine } from "./orchestrator.js";

// ── Agents ────────────────────────────────────────────────────────────────────
export { scoreDimensions }        from "./agents/dimension.scorer.agent.js";
export { resolveQualityWeights }  from "./agents/weight.manager.agent.js";
export { aggregateWeightedScore } from "./agents/score.aggregator.agent.js";
export { classifyQualityGrade }   from "./agents/grade.classifier.agent.js";

// ── Utilities ─────────────────────────────────────────────────────────────────
export { normalizeScore }   from "./utils/normalize.util.js";
export { clamp }            from "./utils/clamp.util.js";
export { normalizeWeights } from "./utils/weight.util.js";
