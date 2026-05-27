import type { RuntimeContext, RuntimeHealth } from '../types/runtime.types.ts';
import type { ValidationResult } from '../types/execution.types.ts';

const MAX_FAILURE_RATE  = 0.5;
const MIN_TIMEOUT_MS    = 500;
const MAX_TIMEOUT_MS    = 600_000; // 10 minutes

export function validateRuntimeContext(ctx: RuntimeContext): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!ctx.runId)     errors.push('runId is required');
  if (!ctx.projectId) errors.push('projectId is required');
  if (!ctx.cwd)       errors.push('cwd is required');

  if (ctx.timeoutMs !== undefined) {
    if (ctx.timeoutMs < MIN_TIMEOUT_MS) {
      warnings.push(`timeoutMs (${ctx.timeoutMs}) is below recommended minimum (${MIN_TIMEOUT_MS}ms)`);
    }
    if (ctx.timeoutMs > MAX_TIMEOUT_MS) {
      warnings.push(`timeoutMs (${ctx.timeoutMs}) exceeds max (${MAX_TIMEOUT_MS}ms)`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateRuntimeHealth(health: RuntimeHealth): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (health.failureRate >= MAX_FAILURE_RATE) {
    errors.push(`Failure rate ${(health.failureRate * 100).toFixed(0)}% exceeds threshold`);
  } else if (health.failureRate > 0.3) {
    warnings.push('Elevated failure rate detected');
  }

  return { valid: health.failureRate < MAX_FAILURE_RATE, errors, warnings };
}
