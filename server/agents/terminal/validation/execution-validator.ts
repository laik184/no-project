/**
 * server/agents/terminal/validation/execution-validator.ts
 *
 * Validates execution requests before they enter the execution loop.
 * Checks for invalid states, missing context, and malformed inputs.
 */

import type { ExecutionStep, ValidationResult } from '../types/terminal.types.ts';

export function validateExecutionRequest(
  runId:     string,
  projectId: string,
  steps:     readonly ExecutionStep[],
): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!runId || !runId.trim()) {
    errors.push('runId is required and must be a non-empty string');
  }

  if (!projectId || !projectId.trim()) {
    errors.push('projectId is required and must be a non-empty string');
  }

  if (!Array.isArray(steps)) {
    errors.push('steps must be an array');
    return { valid: false, errors, warnings };
  }

  if (steps.length === 0) {
    warnings.push('Execution requested with zero steps');
  }

  if (steps.length > 200) {
    errors.push(`Too many steps: ${steps.length} (max 200)`);
  }

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step.id)   errors.push(`Step[${i}] missing id`);
    if (!step.type) errors.push(`Step[${i}] missing type`);
    if (!step.taskId) errors.push(`Step[${i}] missing taskId`);
    if (step.timeoutMs <= 0) errors.push(`Step[${i}] invalid timeoutMs`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateSessionState(
  runId:       string,
  sessionRunId: string,
): ValidationResult {
  const errors: string[] = [];

  if (runId !== sessionRunId) {
    errors.push(`runId mismatch: expected ${sessionRunId}, got ${runId}`);
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}
