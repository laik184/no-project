import type { ExitCodeCategory, ValidationResult } from '../types/execution.types.ts';

const SIGNAL_OFFSET = 128;

export function categorizeExitCode(code: number): ExitCodeCategory {
  if (code === 0)                      return 'success';
  if (code === 124 || code === 137)    return 'timeout';
  if (code > SIGNAL_OFFSET)            return 'signal';
  return 'error';
}

export function validateExitCode(code: number): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];
  const category = categorizeExitCode(code);

  if (category === 'error') {
    errors.push(`Command failed with exit code ${code}`);
  } else if (category === 'timeout') {
    errors.push(`Command timed out (exit code ${code})`);
  } else if (category === 'signal') {
    const sig = code - SIGNAL_OFFSET;
    errors.push(`Process terminated by signal ${sig} (exit code ${code})`);
  }

  return { valid: code === 0, errors, warnings };
}

export function isSuccess(code: number): boolean {
  return code === 0;
}

export function isTimeout(code: number): boolean {
  return code === 124 || code === 137;
}
