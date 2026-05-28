/**
 * server/agents/planner/validation/planning-validator.ts
 *
 * Validates planning requests and execution plan integrity.
 * Pure functions — no side effects, no tool calls.
 */

import type {
  PlanningRequest,
  ExecutionPlan,
  ValidationResult,
} from '../types/planner.types.ts';

const MIN_GOAL_LENGTH = 3;
const MAX_GOAL_LENGTH = 4_000;

// ── Request validation ────────────────────────────────────────────────────────

export function validatePlanningRequest(req: PlanningRequest): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!req.goal || typeof req.goal !== 'string') {
    errors.push('goal is required and must be a string');
  } else {
    const trimmed = req.goal.trim();
    if (trimmed.length < MIN_GOAL_LENGTH) {
      errors.push(`goal must be at least ${MIN_GOAL_LENGTH} characters`);
    }
    if (trimmed.length > MAX_GOAL_LENGTH) {
      errors.push(`goal must be at most ${MAX_GOAL_LENGTH} characters`);
    }
  }

  if (!req.projectId || typeof req.projectId !== 'string') {
    errors.push('projectId is required');
  }

  if (!req.sandboxRoot || typeof req.sandboxRoot !== 'string') {
    errors.push('sandboxRoot is required');
  }

  if (req.goal && req.goal.trim().length > 0 && req.goal.trim().length < 10) {
    warnings.push('goal is very short — planning quality may be limited');
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Runtime context validation ────────────────────────────────────────────────

export function validateRuntimeContext(
  runId:       string,
  projectId:   string,
  sandboxRoot: string,
): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!runId || typeof runId !== 'string') {
    errors.push('runId is required');
  }

  if (!projectId || typeof projectId !== 'string') {
    errors.push('projectId is required');
  }

  if (!sandboxRoot || typeof sandboxRoot !== 'string') {
    errors.push('sandboxRoot is required');
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Execution plan validation ─────────────────────────────────────────────────

export function validateExecutionPlan(plan: ExecutionPlan): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!plan.planId) errors.push('plan.planId is missing');
  if (!plan.runId)  errors.push('plan.runId is missing');
  if (!plan.goal || plan.goal.trim().length === 0) {
    errors.push('plan.goal is empty');
  }

  if (!Array.isArray(plan.phases) || plan.phases.length === 0) {
    errors.push('plan must have at least one phase');
  } else {
    for (const phase of plan.phases) {
      if (!Array.isArray(phase.tasks)) {
        errors.push(`phase[${phase.index}] has no tasks array`);
        continue;
      }
      for (const task of phase.tasks) {
        if (!task.id)       errors.push(`task in phase[${phase.index}] is missing id`);
        if (!task.toolName) errors.push(`task[${task.id ?? '?'}] is missing toolName`);
        if (!task.label)    warnings.push(`task[${task.id ?? '?'}] has no label`);
      }
    }
  }

  if (plan.totalTasks === 0) {
    warnings.push('plan has zero total tasks');
  }

  return { valid: errors.length === 0, errors, warnings };
}
