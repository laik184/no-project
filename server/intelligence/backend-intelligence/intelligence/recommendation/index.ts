// ── Orchestrator ──────────────────────────────────────────────────────────────
export { buildRecommendations } from "./orchestrator.js";

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  AnalysisFinding,
  AnalysisResult,
  ConsistencyOutput,
  ConsistencyTruth,
  FixRecommendation,
  GeneratedAction,
  ImprovementSuggestion,
  PriorityOutput,
  PrioritySignal,
  Recommendation,
  RecommendationCandidate,
  RecommendationCategory,
  RecommendationContext,
  RecommendationImpact,
  RecommendationInput,
  RecommendationResponse,
} from "./types.js";

// ── Canonical enumerations ────────────────────────────────────────────────────
export {
  ALL_RECOMMENDATION_CATEGORIES,
  ALL_RECOMMENDATION_IMPACTS,
} from "./types.js";

// ── State management ──────────────────────────────────────────────────────────
export type { RecommendationState } from "./state.js";
export {
  createEmptyRecommendationState,
  toResponse,
  withCandidates,
  withRecommendations,
} from "./state.js";

// ── Utilities ─────────────────────────────────────────────────────────────────
export {
  applyConsistency,
  applyPriority,
  normalizePriority,
  sortByPriority,
  toPriorityMap,
  toTruthMap,
}                             from "./utils/candidate.util.js";
export { dedupeCandidates }   from "./utils/dedupe.util.js";
export { formatRecommendations } from "./utils/format.util.js";
export { groupFindings }      from "./utils/grouping.util.js";
