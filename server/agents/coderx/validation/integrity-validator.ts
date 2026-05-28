/**
 * server/agents/coderx/validation/integrity-validator.ts
 *
 * Validates the integrity of the execution flow.
 * Detects corrupted state and invalid reasoning transitions.
 */

import type { CodingStepStatus, CodingSessionStatus } from '../types/coderx.types.ts';

export class IntegrityValidationError extends Error {
  constructor(message: string) {
    super(`[integrity-validator] ${message}`);
    this.name = 'IntegrityValidationError';
  }
}

// ── Valid step status transitions ─────────────────────────────────────────────

const VALID_STEP_TRANSITIONS: Record<CodingStepStatus, CodingStepStatus[]> = {
  pending:   ['running', 'skipped', 'cancelled'],
  running:   ['completed', 'failed', 'retrying', 'cancelled'],
  retrying:  ['running', 'failed', 'cancelled'],
  completed: [],
  failed:    [],
  skipped:   [],
  cancelled: [],
};

// ── Valid session status transitions ──────────────────────────────────────────

const VALID_SESSION_TRANSITIONS: Record<CodingSessionStatus, CodingSessionStatus[]> = {
  idle:      ['analyzing'],
  analyzing: ['planning', 'failed'],
  planning:  ['executing', 'failed'],
  executing: ['completed', 'failed'],
  completed: [],
  failed:    [],
};

// ── Step transition guard ─────────────────────────────────────────────────────

export function assertValidStepTransition(
  from: CodingStepStatus,
  to:   CodingStepStatus,
): void {
  const allowed = VALID_STEP_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new IntegrityValidationError(
      `Invalid step transition: ${from} → ${to}. Allowed: ${allowed.join(', ') || 'none'}.`,
    );
  }
}

// ── Session transition guard ──────────────────────────────────────────────────

export function assertValidSessionTransition(
  from: CodingSessionStatus,
  to:   CodingSessionStatus,
): void {
  const allowed = VALID_SESSION_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new IntegrityValidationError(
      `Invalid session transition: ${from} → ${to}. Allowed: ${allowed.join(', ') || 'none'}.`,
    );
  }
}

// ── Plan integrity ────────────────────────────────────────────────────────────

export function assertNonEmptyPlan(stepCount: number): void {
  if (stepCount === 0) {
    throw new IntegrityValidationError('Execution plan is empty — no steps to run.');
  }
}

export function assertStepExists(stepId: string, found: boolean): void {
  if (!found) {
    throw new IntegrityValidationError(`Step "${stepId}" not found in state registry.`);
  }
}
