/**
 * validation/execution-validator.ts
 * Validates execution results (exit codes, stdout, stderr).
 * Called by server/tools/verifier/validation/execution-validator.ts.
 */

import type { OutputValidationResult } from '../types/validation.types.ts';

export interface ExecutionInput {
  exitCode: number;
  stdout:   string;
  stderr:   string;
  command:  string;
}

export function validateExecution(input: ExecutionInput): OutputValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (input.exitCode !== 0) {
    errors.push(`Process exited with code ${input.exitCode}`);
    const stderrLines = input.stderr.split('\n').filter((l) => l.trim()).slice(0, 3);
    errors.push(...stderrLines.map((l) => `stderr: ${l}`));
  }

  const combined = `${input.stdout}\n${input.stderr}`;
  for (const line of combined.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    if (/\bwarn(ing)?\b/i.test(t) && !/\berror\b/i.test(t)) {
      warnings.push(t.slice(0, 200));
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateExitCode(exitCode: number, allowedCodes: number[] = [0]): OutputValidationResult {
  const valid = allowedCodes.includes(exitCode);
  return {
    valid,
    errors:   valid ? [] : [`Exit code ${exitCode} not in allowed: [${allowedCodes.join(', ')}]`],
    warnings: [],
  };
}
