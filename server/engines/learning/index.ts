/**
 * server/engines/learning/index.ts
 * Public API for the learning engine.
 */

export { runLearningEngine }                       from "./learning-engine.ts";
export type { LoopResult }                         from "./learning-engine.ts";
export { persistFix, loadRecentFixes }             from "./fix-persister.ts";
export { recordFailurePattern, getKnownFix }       from "./failure-pattern-store.ts";
export type { FixRecord, FailurePattern, LearningResult } from "./types.ts";
