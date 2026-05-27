import type { OutputValidationResult } from '../types/validation.types.ts';
import { parseBuildErrors, hasTerminalBuildError } from './build-error-parser.ts';

const SUCCESS_MARKERS = [
  'build succeeded',
  'successfully compiled',
  'built in',
  '✓ built',
  'done in',
  'compiled successfully',
];

export function validateBuildResult(
  stdout:   string,
  stderr:   string,
  exitCode: number,
): OutputValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];
  const combined  = `${stdout}\n${stderr}`;

  if (exitCode !== 0) {
    errors.push(`Build process exited with code ${exitCode}`);
  }

  if (hasTerminalBuildError(combined)) {
    errors.push('Terminal build failure detected in output');
  }

  const buildErrors = parseBuildErrors(stderr || combined);
  for (const e of buildErrors.slice(0, 10)) {
    errors.push(e.message);
  }

  const hasSuccess = SUCCESS_MARKERS.some((m) =>
    combined.toLowerCase().includes(m.toLowerCase()),
  );

  if (!hasSuccess && exitCode === 0 && errors.length === 0) {
    warnings.push('No explicit build success marker found');
  }

  return { valid: errors.length === 0, exitCode, errors, warnings };
}

export function isBuildSuccessful(exitCode: number, stdout: string, stderr: string): boolean {
  const result = validateBuildResult(stdout, stderr, exitCode);
  return result.valid;
}
