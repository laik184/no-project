/**
 * server/agents/executor/validation/integrity-validator.ts
 *
 * Validates execution flow integrity.
 * Catches corrupted step state and invalid lifecycle transitions.
 */

import type { ExecutionStepStatus, RuntimeStep } from '../types/executor.types.ts';

export class IntegrityValidationError extends Error {
  constructor(message: string) {
    super(`[integrity-validator] ${message}`);
    this.name = 'IntegrityValidationError';
  }
}

export interface IntegrityResult {
  ok:      boolean;
  reason?: string;
}

// ── Allowed status transitions ────────────────────────────────────────────────
//   pending   → running | skipped | cancelled
//   running   → completed | failed | retrying
//   retrying  → running | failed | cancelled
//   completed → (terminal)
//   failed    → (terminal)
//   skipped   → (terminal)
//   cancelled → (terminal)

const ALLOWED: Record<ExecutionStepStatus, ExecutionStepStatus[]> = {
  pending:   ['running', 'skipped', 'cancelled'],
  running:   ['completed', 'failed', 'retrying'],
  retrying:  ['running', 'failed', 'cancelled'],
  completed: [],
  failed:    [],
  skipped:   [],
  cancelled: [],
};

export function validateTransition(
  stepId: string,
  from:   ExecutionStepStatus,
  to:     ExecutionStepStatus,
): IntegrityResult {
  const allowed = ALLOWED[from];
  if (!allowed) return { ok: false, reason: `Unknown status "${from}" for step ${stepId}.` };
  if (!allowed.includes(to)) {
    return {
      ok:     false,
      reason: `Invalid transition [${from}→${to}] for step ${stepId}. Allowed: [${allowed.join(', ')}].`,
    };
  }
  return { ok: true };
}

export function assertTransition(stepId: string, from: ExecutionStepStatus, to: ExecutionStepStatus): void {
  const r = validateTransition(stepId, from, to);
  if (!r.ok) throw new IntegrityValidationError(r.reason!);
}

export function isTerminal(status: ExecutionStepStatus): boolean {
  return ALLOWED[status]?.length === 0;
}

export function validateRuntimeStep(rs: RuntimeStep): IntegrityResult {
  if (!rs.step?.stepId?.trim()) return { ok: false, reason: 'RuntimeStep missing stepId.' };
  if (!rs.step.toolName?.trim()) return { ok: false, reason: `Step ${rs.step.stepId} missing toolName.` };
  if (rs.status === 'completed' && rs.output === undefined) {
    return { ok: false, reason: `Step ${rs.step.stepId} is completed but has no output.` };
  }
  if (rs.status === 'failed' && !rs.error) {
    return { ok: false, reason: `Step ${rs.step.stepId} is failed but has no error message.` };
  }
  if (rs.retryCount < 0) {
    return { ok: false, reason: `Step ${rs.step.stepId} has negative retryCount.` };
  }
  return { ok: true };
}

export function assertRuntimeStep(rs: RuntimeStep): void {
  const r = validateRuntimeStep(rs);
  if (!r.ok) throw new IntegrityValidationError(r.reason!);
}
