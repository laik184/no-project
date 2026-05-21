/**
 * server/engines/reflection/index.ts
 * Public API for the reflection engine.
 */

export { runReflectionEngine }  from "./reflection-engine.ts";
export { analyzeFailures }      from "./failure-analyzer.ts";
export { detectRetryLoop }      from "./retry-loop-detector.ts";
export { recommendRecovery }    from "./recovery-recommender.ts";
export type {
  FailureType,
  FailureAnalysis,
  RetryLoopReport,
  RecoveryRecommendation,
  ReflectionResult,
} from "./types.ts";
