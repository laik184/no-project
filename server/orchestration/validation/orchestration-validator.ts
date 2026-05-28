/**
 * server/orchestration/validation/orchestration-validator.ts
 *
 * Validates orchestration requests and runtime context.
 * Catches: malformed requests, invalid state, missing context.
 * Pure validation — no side effects, no tool execution.
 */

import type { OrchestrationRequest, OrchestrationContext, ValidationResult } from '../types/orchestration.types.ts';

// ── Request validation ────────────────────────────────────────────────────────

export function validateRequest(req: OrchestrationRequest): ValidationResult {
  const errors: string[] = [];

  if (!req.orchestrationId || typeof req.orchestrationId !== 'string') {
    errors.push('orchestrationId is required and must be a string');
  }
  if (!req.runId || typeof req.runId !== 'string') {
    errors.push('runId is required and must be a string');
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
  if (req.goal && req.goal.length > 8_000) {
    errors.push('goal exceeds maximum length of 8000 characters');
  }
  if (req.options?.maxRetries !== undefined) {
    if (typeof req.options.maxRetries !== 'number' || req.options.maxRetries < 0) {
      errors.push('options.maxRetries must be a non-negative number');
    }
  }
  if (req.options?.timeoutMs !== undefined) {
    if (typeof req.options.timeoutMs !== 'number' || req.options.timeoutMs <= 0) {
      errors.push('options.timeoutMs must be a positive number');
    }
  }
  if (req.options?.retry) {
    const { maxAttempts, delayMs, backoff } = req.options.retry;
    if (typeof maxAttempts !== 'number' || maxAttempts < 1) {
      errors.push('retry.maxAttempts must be >= 1');
    }
    if (typeof delayMs !== 'number' || delayMs < 0) {
      errors.push('retry.delayMs must be >= 0');
    }
    if (!['none', 'linear', 'exponential'].includes(backoff)) {
      errors.push("retry.backoff must be 'none', 'linear', or 'exponential'");
    }
  }

  return { valid: errors.length === 0, errors };
}

// ── Context validation ────────────────────────────────────────────────────────

export function validateContext(ctx: OrchestrationContext): ValidationResult {
  const errors: string[] = [];

  if (!ctx.orchestrationId) errors.push('context.orchestrationId is missing');
  if (!ctx.runId)           errors.push('context.runId is missing');
  if (!ctx.projectId)       errors.push('context.projectId is missing');
  if (!ctx.sandboxRoot)     errors.push('context.sandboxRoot is missing');
  if (!ctx.sessionId)       errors.push('context.sessionId is missing');
  if (!(ctx.startedAt instanceof Date)) {
    errors.push('context.startedAt must be a Date instance');
  }

  return { valid: errors.length === 0, errors };
}

// ── State transition validation ───────────────────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  idle:      ['planning'],
  planning:  ['running', 'failed', 'cancelled'],
  running:   ['completed', 'failed', 'paused', 'escalated', 'cancelled'],
  paused:    ['running', 'cancelled'],
  escalated: ['running', 'failed', 'cancelled'],
  failed:    ['running'],
  completed: [],
  cancelled: [],
};

export function validateStatusTransition(
  from: string,
  to:   string,
): ValidationResult {
  const allowed = VALID_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    return {
      valid:  false,
      errors: [`Invalid status transition: ${from} → ${to}. Allowed: [${allowed.join(', ')}]`],
    };
  }
  return { valid: true, errors: [] };
}
