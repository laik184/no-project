/**
 * server/quantum/verification/parallel-validator.ts
 *
 * Fail-Closed Parallel Execution Validator (Phase 7).
 *
 * Thin coordinator that composes the six category validators into one
 * pre-wave gate.  Category implementations live in ./validators/ so
 * each file stays under 250 lines.
 *
 * Design: fail-closed — any invalid state throws ParallelValidationError.
 * NO silent fallback. NO partial validation. NO optional checks.
 */

import type { ExecutionGraph } from "../../engine/graph/graph-types.ts";

export { ParallelValidationError }   from "./validators/aggregation-validator.ts";
export type {
  ValidationCategory,
  ValidationResult,
  ValidationCheck,
}                                    from "./validators/validator-helpers.ts";

export { validateAggregation }       from "./validators/aggregation-validator.ts";
export { validateWorkerPool }        from "./validators/worker-validator.ts";
export { validateMemoryQueues }      from "./validators/memory-validator.ts";
export { validateGraph }             from "./validators/graph-validator.ts";
export { validateLocks }             from "./validators/lock-validator.ts";

import { validateWorkerPool }        from "./validators/worker-validator.ts";
import { validateMemoryQueues }      from "./validators/memory-validator.ts";
import { validateGraph }             from "./validators/graph-validator.ts";
import { validateLocks }             from "./validators/lock-validator.ts";

/**
 * Run ALL validators in sequence before a parallel wave executes.
 * Throws ParallelValidationError on the FIRST failure (fail-closed).
 */
export function validateBeforeWave(params: {
  runId:  string;
  graph:  ExecutionGraph;
}): void {
  validateWorkerPool(params.runId);
  validateMemoryQueues(params.runId);
  validateGraph(params.runId, params.graph);
  validateLocks(params.runId);
}
