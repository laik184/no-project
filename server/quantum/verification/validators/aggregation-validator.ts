/**
 * server/quantum/verification/validators/aggregation-validator.ts
 *
 * Validates DAG-wave aggregation output before graph execution continues.
 * Fail-closed: throws ParallelValidationError on any unsafe state.
 */

import {
  ParallelValidationError, emitValidation,
  type ValidationCategory, type ValidationResult, type ValidationCheck,
} from "./validator-helpers.ts";

export { ParallelValidationError, type ValidationCategory, type ValidationResult, type ValidationCheck };

/**
 * Validates that a wave's aggregation output is safe.
 * Throws ParallelValidationError if aggregation is unsafe.
 */
export function validateAggregation(params: {
  runId:      string;
  waveIndex:  number;
  safe:       boolean;
  confidence: number;
  conflicts:  string[];
}): ValidationResult {
  const t0     = Date.now();
  const checks: ValidationCheck[] = [];

  checks.push({
    name:   "aggregation.safe",
    passed: params.safe,
    detail: params.safe ? undefined : "Wave aggregation returned safe=false",
  });

  const MIN_CONFIDENCE = 0.5;
  const confOk = params.confidence >= MIN_CONFIDENCE;
  checks.push({
    name:   "aggregation.confidence",
    passed: confOk,
    detail: confOk
      ? undefined
      : `Confidence ${params.confidence.toFixed(2)} below minimum ${MIN_CONFIDENCE}`,
  });

  const conflictsFree = params.conflicts.length === 0;
  checks.push({
    name:   "aggregation.no_conflicts",
    passed: conflictsFree,
    detail: conflictsFree
      ? undefined
      : `Unresolved conflicts: ${params.conflicts.join(", ")}`,
  });

  const allPassed = checks.every(c => c.passed);
  emitValidation(params.runId, "aggregation", allPassed, checks);

  if (!allPassed) {
    const failed = checks.filter(c => !c.passed).map(c => c.detail).join("; ");
    throw new ParallelValidationError("aggregation", "UNSAFE_AGGREGATION", failed);
  }

  return { passed: true, category: "aggregation", checks, durationMs: Date.now() - t0 };
}
