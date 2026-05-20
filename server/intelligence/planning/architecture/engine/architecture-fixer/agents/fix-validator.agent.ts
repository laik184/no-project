import type { ValidationResult } from "../types.js";
import type { ValidateFixInput, ValidationArtifacts } from "../types.js";

function scoreFromPatches(patchCount: number, originalViolationCount: number): number {
  if (originalViolationCount === 0) return 100;
  const resolvedRatio = Math.min(1, patchCount / originalViolationCount);
  return Math.max(0, Math.min(100, Math.round(resolvedRatio * 100)));
}

export function validateFixes(input: ValidateFixInput): ValidationArtifacts {
  const warnings: string[] = [];

  if (input.patches.length === 0) {
    warnings.push("No patches generated; no fix applied.");
  }

  const score = scoreFromPatches(input.patches.length, input.originalViolationCount);
  const result: ValidationResult = Object.freeze({
    isValid: input.patches.every((patch) => patch.reversible),
    score,
    warnings: Object.freeze(warnings),
  });

  return Object.freeze({
    result,
    regressionWarnings: Object.freeze(warnings),
  });
}
