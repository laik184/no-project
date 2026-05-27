import type { ValidationResult } from '../shared/terminal-types.ts';

export function validatePid(pid: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) {
    errors.push(`Invalid PID: ${pid}`);
  }
  return { valid: errors.length === 0, errors, warnings: [] };
}

export function validateRunId(runId: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof runId !== 'string' || !runId.trim()) {
    errors.push('runId must be a non-empty string');
  }
  return { valid: errors.length === 0, errors, warnings: [] };
}
