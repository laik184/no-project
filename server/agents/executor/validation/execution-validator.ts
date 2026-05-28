/**
 * server/agents/executor/validation/execution-validator.ts
 *
 * Validates execution requests at the agent boundary.
 * Catches malformed inputs, invalid state, and missing context
 * before any dispatch reaches the tool layer.
 */

import type {
  ExecutorAgentInput,
  ExecutionTask,
  ExecutorExecutionContext,
} from '../types/executor.types.ts';

export class ExecutionValidationError extends Error {
  constructor(message: string) {
    super(`[execution-validator] ${message}`);
    this.name = 'ExecutionValidationError';
  }
}

export interface ValidationResult {
  ok:      boolean;
  reason?: string;
}

// ── Context ───────────────────────────────────────────────────────────────────

export function validateContext(ctx: ExecutorExecutionContext): ValidationResult {
  if (!ctx.runId?.trim())       return { ok: false, reason: 'runId is missing or empty.' };
  if (!ctx.projectId?.trim())   return { ok: false, reason: 'projectId is missing or empty.' };
  if (!ctx.sandboxRoot?.trim()) return { ok: false, reason: 'sandboxRoot is missing or empty.' };
  if (!ctx.sessionId?.trim())   return { ok: false, reason: 'sessionId is missing or empty.' };
  return { ok: true };
}

export function assertContext(ctx: ExecutorExecutionContext): void {
  const r = validateContext(ctx);
  if (!r.ok) throw new ExecutionValidationError(r.reason!);
}

// ── Task ──────────────────────────────────────────────────────────────────────

export function validateTask(task: ExecutionTask): ValidationResult {
  if (!task.taskId?.trim())      return { ok: false, reason: 'task.taskId is required.' };
  if (!task.kind)                return { ok: false, reason: `task ${task.taskId}: kind is required.` };
  if (!task.description?.trim()) return { ok: false, reason: `task ${task.taskId}: description is required.` };
  if (!task.input || typeof task.input !== 'object') {
    return { ok: false, reason: `task ${task.taskId}: input must be an object.` };
  }
  const VALID_KINDS = new Set(['terminal', 'filesystem', 'coding', 'verify', 'browser']);
  if (!VALID_KINDS.has(task.kind)) {
    return { ok: false, reason: `task ${task.taskId}: unknown kind "${task.kind}".` };
  }
  return { ok: true };
}

// ── Agent input ───────────────────────────────────────────────────────────────

export function validateAgentInput(input: ExecutorAgentInput): ValidationResult {
  if (!input.runId?.trim())       return { ok: false, reason: 'runId is required.' };
  if (!input.projectId?.trim())   return { ok: false, reason: 'projectId is required.' };
  if (!input.sandboxRoot?.trim()) return { ok: false, reason: 'sandboxRoot is required.' };
  if (!input.plan)                return { ok: false, reason: 'plan is required.' };
  if (!input.plan.planId?.trim()) return { ok: false, reason: 'plan.planId is required.' };
  if (!Array.isArray(input.plan.tasks) || input.plan.tasks.length === 0) {
    return { ok: false, reason: 'plan.tasks must be a non-empty array.' };
  }
  for (const task of input.plan.tasks) {
    const r = validateTask(task);
    if (!r.ok) return r;
  }
  return { ok: true };
}

export function assertAgentInput(input: ExecutorAgentInput): void {
  const r = validateAgentInput(input);
  if (!r.ok) throw new ExecutionValidationError(r.reason!);
}
