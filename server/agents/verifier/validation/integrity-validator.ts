/**
 * server/agents/verifier/validation/integrity-validator.ts
 * Validates execution flow integrity and transition correctness.
 */

import type { VerifierValidationResult, VerifierLifecycleState } from '../types/verifier.types.ts';

const VALID_TRANSITIONS: Record<VerifierLifecycleState, VerifierLifecycleState[]> = {
  idle:        ['validating'],
  validating:  ['executing', 'failed', 'aborted'],
  executing:   ['retrying', 'recovering', 'completing', 'failed', 'aborted'],
  retrying:    ['executing', 'failed', 'aborted'],
  recovering:  ['executing', 'completing', 'failed', 'aborted'],
  completing:  [],
  failed:      [],
  aborted:     [],
};

export function validateStateTransition(
  from: VerifierLifecycleState,
  to:   VerifierLifecycleState,
): VerifierValidationResult {
  const allowed = VALID_TRANSITIONS[from] ?? [];
  const valid   = allowed.includes(to);
  return {
    valid,
    errors:   valid ? [] : [`Invalid transition: ${from} → ${to}`],
    warnings: [],
  };
}

export function validateExecutionIntegrity(
  steps: number,
  completed: number,
  failed: number,
): VerifierValidationResult {
  const errors: string[] = [];

  if (completed > steps) {
    errors.push(`Integrity violation: completed (${completed}) exceeds total steps (${steps})`);
  }
  if (failed > completed) {
    errors.push(`Integrity violation: failed (${failed}) exceeds completed (${completed})`);
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}
