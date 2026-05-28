/**
 * build/build-validator.ts
 * Validates build output to determine pass/fail.
 * Called by server/tools/verifier/build/build-validator.ts.
 */

export interface OutputValidationResult {
  valid:    boolean;
  errors:   string[];
  warnings: string[];
}

const FATAL_RE = /error TS\d{4}|build failed|fatal error/i;
const WARN_RE  = /\bwarn(ing)?\b/i;

export function validateBuildResult(
  stdout:   string,
  stderr:   string,
  exitCode: number,
): OutputValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (exitCode !== 0) {
    errors.push(`Build exited with code ${exitCode}`);
  }

  const combined = `${stdout}\n${stderr}`;
  const lines    = combined.split('\n').map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    if (FATAL_RE.test(line)) {
      errors.push(line.slice(0, 200));
    } else if (WARN_RE.test(line)) {
      warnings.push(line.slice(0, 200));
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
