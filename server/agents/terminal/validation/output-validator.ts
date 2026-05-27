import type { ValidationResult } from '../types/execution.types.ts';
import { isSuspiciousOutput } from '../utils/stream-utils.ts';

const CONTENT_STEP_TYPES = new Set([
  'generate_frontend', 'generate_backend', 'generate_api',
  'generate_database', 'generate_auth', 'generate_component',
  'write_file', 'edit_file',
]);

export function validateGeneratedOutput(
  stepType: string,
  content:  string | undefined,
): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (CONTENT_STEP_TYPES.has(stepType)) {
    if (!content || content.trim().length === 0) {
      errors.push(`Step '${stepType}' must produce non-empty content`);
    } else if (content.trim().length < 10) {
      warnings.push('Generated content is suspiciously short (<10 chars)');
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateCommandOutput(
  exitCode: number,
  stdout:   string,
  stderr:   string,
): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (exitCode !== 0) {
    errors.push(`Non-zero exit code: ${exitCode}`);
    if (stderr) errors.push(`stderr: ${stderr.slice(0, 300)}`);
  }

  if (isSuspiciousOutput(stdout, exitCode)) {
    warnings.push('stdout contains error-like keywords despite exit 0');
  }

  return { valid: errors.length === 0, errors, warnings };
}
