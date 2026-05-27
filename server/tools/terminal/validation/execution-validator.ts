import type { ExecutionOptions, ValidationResult } from '../shared/terminal-types.ts';
import { validateCommandSafe } from './command-validator.ts';
import { isSandboxSafe } from './sandbox-validator.ts';

export function validateExecutionOptions(opts: Partial<ExecutionOptions>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!opts.command?.trim()) errors.push('command is required');
  else {
    const cmdResult = validateCommandSafe(opts.command);
    errors.push(...cmdResult.errors);
    warnings.push(...cmdResult.warnings);
  }

  if (!opts.runId?.trim())     errors.push('runId is required');
  if (!opts.projectId?.trim()) errors.push('projectId is required');

  if (opts.timeoutMs !== undefined && (opts.timeoutMs < 0 || opts.timeoutMs > 300_000)) {
    warnings.push('timeoutMs should be between 0 and 300000');
  }

  return { valid: errors.length === 0, errors, warnings };
}
