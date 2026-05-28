/**
 * validation/output-validator.ts
 * Validates command/build output for errors and warnings.
 * Called by server/tools/verifier/validation/output-validator.ts.
 */

import type { OutputValidationResult } from '../types/validation.types.ts';

const FATAL_RE = /error TS\d{4}|build failed|fatal error|cannot find module/i;
const WARN_RE  = /\bwarn(ing)?\b/i;

export function validateCommandOutput(
  stdout:   string,
  stderr:   string,
  exitCode: number,
): OutputValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (exitCode !== 0) errors.push(`Exited with code ${exitCode}`);

  const combined = `${stdout}\n${stderr}`;
  for (const line of combined.split('\n').map((l) => l.trim()).filter(Boolean)) {
    if (FATAL_RE.test(line)) {
      errors.push(line.slice(0, 200));
    } else if (WARN_RE.test(line)) {
      warnings.push(line.slice(0, 200));
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateBuildOutput(stdout: string, exitCode: number): OutputValidationResult {
  return validateCommandOutput(stdout, '', exitCode);
}
