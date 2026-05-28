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

// ── Recovery / rollback / escalation transition validation ────────────────────

export type RecoveryTransitionKind = 'recovery' | 'rollback' | 'escalation' | 'workflow';

export interface RecoveryIntegrityResult {
  ok:      boolean;
  reason?: string;
  kind:    RecoveryTransitionKind;
}

/**
 * Validate that a recovery transition is semantically safe.
 * Recovery is only valid when a step is in a failed or retrying state.
 */
export function validateRecoveryTransition(
  stepId:     string,
  stepStatus: ExecutionStepStatus,
  kind:       RecoveryTransitionKind,
): RecoveryIntegrityResult {
  if (kind === 'recovery') {
    if (!['failed', 'retrying'].includes(stepStatus)) {
      return {
        ok:     false,
        reason: `Recovery invalid for step ${stepId} in status "${stepStatus}" — requires failed|retrying`,
        kind,
      };
    }
  }

  if (kind === 'rollback') {
    if (stepStatus === 'completed') {
      return {
        ok:     false,
        reason: `Rollback invalid for step ${stepId} — step is already completed`,
        kind,
      };
    }
  }

  if (kind === 'escalation') {
    if (stepStatus === 'completed' || stepStatus === 'skipped') {
      return {
        ok:     false,
        reason: `Escalation invalid for step ${stepId} in terminal status "${stepStatus}"`,
        kind,
      };
    }
  }

  return { ok: true, kind };
}

/**
 * Validate workflow integrity: all required steps must be present
 * and in a consistent state before the workflow can be marked complete.
 */
export function validateWorkflowIntegrity(steps: RuntimeStep[]): IntegrityResult {
  if (steps.length === 0) return { ok: false, reason: 'Workflow has no steps' };

  const running  = steps.filter((s) => s.status === 'running');
  const retrying = steps.filter((s) => s.status === 'retrying');

  if (running.length > 0 || retrying.length > 0) {
    return {
      ok:     false,
      reason: `Workflow integrity check failed: ${running.length} running, ${retrying.length} retrying step(s) still active`,
    };
  }

  const failedRequired = steps.filter((s) => s.status === 'failed');
  if (failedRequired.length > 0) {
    const ids = failedRequired.map((s) => s.step.stepId).join(', ');
    return {
      ok:     false,
      reason: `Workflow has ${failedRequired.length} failed step(s): ${ids}`,
    };
  }

  return { ok: true };
}
