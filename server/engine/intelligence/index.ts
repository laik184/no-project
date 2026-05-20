/**
 * server/engine/intelligence/index.ts
 *
 * Public API for the Phase 6 Autonomous Intelligence Loop.
 */

export { reflect }                            from "./reflection-engine.ts";
export { scoreExecution, analyzeTrend }       from "./execution-scorer.ts";
export {
  estimateConfidence,
  extractSignals,
  quickConfidenceCheck,
}                                             from "./confidence-estimator.ts";

export type { RunContext, ReflectionResult, OutcomeType } from "./reflection-engine.ts";
export type { ExecutionMetrics, ExecutionScore, ScoreTrend } from "./execution-scorer.ts";
export type { ConfidenceSignals, ConfidenceResult }          from "./confidence-estimator.ts";
