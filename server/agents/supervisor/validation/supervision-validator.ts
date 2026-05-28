/**
 * server/agents/supervisor/validation/supervision-validator.ts
 *
 * Validates incoming orchestration requests and supervisor state.
 * Pure functions — no side effects, no tool calls.
 */

import type {
  ValidationResult,
  SupervisionRequest,
  SupervisionTask,
} from '../types/supervisor.types.ts';

const VALID_DOMAINS = new Set([
  'planner', 'executor', 'verifier', 'browser', 'filesystem', 'terminal',
]);

const VALID_PRIORITIES = new Set(['critical', 'high', 'normal', 'low']);

// ── Request-level validation ──────────────────────────────────────────────────

export function validateSupervisionRequest(
  req: SupervisionRequest,
): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!req.runId && req.runId !== undefined) {
    errors.push('runId must be a non-empty string if provided');
  }

  if (!req.projectId || typeof req.projectId !== 'string') {
    errors.push('projectId is required and must be a string');
  }

  if (!req.sandboxRoot || typeof req.sandboxRoot !== 'string') {
    errors.push('sandboxRoot is required and must be a string');
  }

  if (!req.goal || typeof req.goal !== 'string' || req.goal.trim().length === 0) {
    errors.push('goal is required and must be a non-empty string');
  }

  if (!Array.isArray(req.tasks)) {
    errors.push('tasks must be an array');
  } else if (req.tasks.length === 0) {
    warnings.push('tasks array is empty — supervision will complete immediately');
  } else {
    for (const task of req.tasks) {
      errors.push(...validateTask(task));
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Task-level validation ─────────────────────────────────────────────────────

export function validateTask(task: SupervisionTask): string[] {
  const errors: string[] = [];

  if (!task.id || typeof task.id !== 'string') {
    errors.push('task.id is required');
  }

  if (!VALID_DOMAINS.has(task.domain)) {
    errors.push(`task.domain "${task.domain}" is not a valid agent domain`);
  }

  if (!task.toolName || typeof task.toolName !== 'string') {
    errors.push(`task[${task.id ?? '?'}].toolName is required`);
  }

  if (!task.label || typeof task.label !== 'string') {
    errors.push(`task[${task.id ?? '?'}].label is required`);
  }

  if (!VALID_PRIORITIES.has(task.priority)) {
    errors.push(`task[${task.id ?? '?'}].priority "${task.priority}" is invalid`);
  }

  if (typeof task.timeoutMs !== 'number' || task.timeoutMs <= 0) {
    errors.push(`task[${task.id ?? '?'}].timeoutMs must be a positive number`);
  }

  if (typeof task.retryLimit !== 'number' || task.retryLimit < 0) {
    errors.push(`task[${task.id ?? '?'}].retryLimit must be >= 0`);
  }

  if (typeof task.input !== 'object' || task.input === null || Array.isArray(task.input)) {
    errors.push(`task[${task.id ?? '?'}].input must be a plain object`);
  }

  return errors;
}

// ── State validation ──────────────────────────────────────────────────────────

export function validateRuntimeContext(
  runId:       string,
  projectId:   string,
  sandboxRoot: string,
): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!runId)       errors.push('runId is missing from supervision context');
  if (!projectId)   errors.push('projectId is missing from supervision context');
  if (!sandboxRoot) errors.push('sandboxRoot is missing from supervision context');

  return { valid: errors.length === 0, errors, warnings };
}
