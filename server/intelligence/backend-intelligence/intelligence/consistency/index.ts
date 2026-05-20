export type {
  ConsistencyStatus,
  Severity,
  ConsistencySignal,
  ConsistencyInput,
  Conflict,
  ConflictDetectionResult,
  ValidationResult,
  FinalTruth,
  ConsistencyOutput,
} from "./types.js";

export { runConsistencyEngine } from "./orchestrator.js";

export { detectConflicts } from "./agents/conflict.detector.agent.js";
export { validateOutputs } from "./agents/validation.engine.agent.js";
export { selectTruth } from "./agents/truth.selector.agent.js";

export {
  deepEqual,
  maxSeverity,
  normalizeScore,
  normalizeStatus,
  scoreDifference,
  severityRank,
  severityWeight,
} from "./utils/compare.util.js";
