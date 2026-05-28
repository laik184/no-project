/**
 * server/agents/verifier/validation/runtime-validator.ts
 * Validates runtime lifecycle state before/during verification.
 */

import type { VerifierValidationResult } from '../types/verifier.types.ts';
import { verifierState }                  from '../core/verifier-state.ts';
import { verifierSession }                from '../core/verifier-session.ts';

export function validateRuntimeState(runId: string): VerifierValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  const session = verifierSession.get(runId);
  if (!session) {
    errors.push(`No active session found for runId: ${runId}`);
    return { valid: false, errors, warnings };
  }

  if (session.state === 'failed' || session.state === 'aborted') {
    errors.push(`Session is in terminal state: ${session.state}`);
  }

  const state = verifierState.get(runId);
  if (state) {
    const failRate = verifierState.failureRate(runId);
    if (failRate > 0.75) {
      warnings.push(`High failure rate: ${(failRate * 100).toFixed(0)}% — verification may be unreliable`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateRuntimeIntegrity(runId: string): VerifierValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  const state = verifierState.get(runId);
  if (!state) {
    warnings.push(`No state found for runId: ${runId} — may be a new run`);
    return { valid: true, errors, warnings };
  }

  if (state.completedSteps > state.totalSteps) {
    errors.push('State integrity error: completedSteps exceeds totalSteps');
  }

  return { valid: errors.length === 0, errors, warnings };
}
