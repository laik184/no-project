import type { ValidationResult, ExecutionOptions } from '../types/execution.types.ts';

const MAX_COMMAND_LENGTH = 2048;

export function validateExecutionOptions(opts: ExecutionOptions): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!opts.runId || opts.runId.trim() === '') {
    errors.push('runId is required');
  }
  if (!opts.projectId || opts.projectId.trim() === '') {
    errors.push('projectId is required');
  }
  if (!opts.command || opts.command.trim() === '') {
    errors.push('command is required');
  }
  if (opts.command && opts.command.length > MAX_COMMAND_LENGTH) {
    errors.push(`command exceeds max length (${MAX_COMMAND_LENGTH})`);
  }
  if (opts.timeoutMs !== undefined && opts.timeoutMs < 100) {
    warnings.push('timeoutMs is very low (<100ms) — likely a misconfiguration');
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateCommandString(command: string): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!command || command.trim() === '') {
    errors.push('Command string must not be empty');
  }
  if (command.includes('\0')) {
    errors.push('Command contains null bytes');
  }
  if (command.length > MAX_COMMAND_LENGTH) {
    errors.push('Command string too long');
  }

  return { valid: errors.length === 0, errors, warnings };
}
