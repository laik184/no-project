/**
 * server/quantum/verification/validators/memory-validator.ts
 *
 * Validates that per-project memory write queues are not backed up
 * beyond safe depth (potential write deadlock indicator).
 * Fail-closed: throws ParallelValidationError on overloaded lanes.
 */

import { memoryWriteQueue } from "../../memory/memory-write-queue.ts";
import {
  ParallelValidationError, emitValidation,
  type ValidationResult, type ValidationCheck,
} from "./validator-helpers.ts";

/**
 * Validates memory queue lane depths are within safe limits.
 * @param maxLaneDepth - Maximum allowed items per lane before rejection.
 */
export function validateMemoryQueues(runId: string, maxLaneDepth = 50): ValidationResult {
  const t0       = Date.now();
  const checks: ValidationCheck[] = [];
  const allStats = memoryWriteQueue.stats();

  const deepLanes: string[] = [];
  for (const lane of allStats) {
    if (lane.depth > maxLaneDepth) {
      deepLanes.push(`${lane.queueKey}(depth=${lane.depth})`);
    }
  }

  const laneOk = deepLanes.length === 0;
  checks.push({
    name:   "memory.lane_depth",
    passed: laneOk,
    detail: laneOk ? undefined : `Overloaded lanes: ${deepLanes.join(", ")}`,
  });

  const allPassed = checks.every(c => c.passed);
  emitValidation(runId, "memory", allPassed, checks);

  if (!allPassed) {
    const failed = checks.filter(c => !c.passed).map(c => c.detail).join("; ");
    throw new ParallelValidationError("memory", "MEMORY_QUEUE_OVERLOADED", failed);
  }

  return { passed: true, category: "memory", checks, durationMs: Date.now() - t0 };
}
