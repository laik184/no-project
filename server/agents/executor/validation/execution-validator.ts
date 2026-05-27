import type { StepResult } from '../types/execution.types.ts';
import type { TaskExecutionResult } from '../types/executor.types.ts';

export interface ExecutionValidationResult {
  valid:    boolean;
  errors:   string[];
  warnings: string[];
}

export function validateStepResult(result: StepResult): ExecutionValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!result.stepId || result.stepId.trim().length === 0) {
    errors.push('stepId is missing');
  }

  if (typeof result.success !== 'boolean') {
    errors.push('success flag must be boolean');
  }

  if (result.durationMs < 0) {
    errors.push('durationMs cannot be negative');
  }

  if (!result.success && !result.error) {
    warnings.push('Step failed but no error message was provided');
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateTaskResult(result: TaskExecutionResult): ExecutionValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!result.taskId || result.taskId.trim().length === 0) {
    errors.push('taskId is missing');
  }

  if (typeof result.success !== 'boolean') {
    errors.push('success flag must be boolean');
  }

  if (result.stepsRun < 0) {
    errors.push('stepsRun cannot be negative');
  }

  if (result.success && result.stepsRun === 0) {
    warnings.push('Task succeeded but ran zero steps');
  }

  if (!result.success && !result.error) {
    warnings.push('Task failed without an error message');
  }

  return { valid: errors.length === 0, errors, warnings };
}
