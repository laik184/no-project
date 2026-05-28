/**
 * validation/integrity-validator.ts
 * Validates the integrity of verification results and state transitions.
 */

import type { VerificationResult, PhaseResult, VerificationStatus } from '../types/verifier.types.ts';

export interface IntegrityCheck {
  passed:   boolean;
  issues:   string[];
}

const VALID_STATUSES: VerificationStatus[] = ['pending', 'running', 'passed', 'failed', 'skipped', 'cancelled'];

export function validateVerificationResult(result: VerificationResult): IntegrityCheck {
  const issues: string[] = [];

  if (!result.runId)       issues.push('Result missing runId');
  if (!result.projectId)   issues.push('Result missing projectId');
  if (!result.startedAt)   issues.push('Result missing startedAt');
  if (!result.completedAt) issues.push('Result missing completedAt');

  if (!VALID_STATUSES.includes(result.overallStatus)) {
    issues.push(`Invalid overallStatus: ${result.overallStatus}`);
  }

  if (result.durationMs < 0) issues.push('Negative durationMs');
  if (result.errorCount < 0) issues.push('Negative errorCount');

  const computedErrors = result.phases.reduce((n, p) => n + p.errors.length, 0);
  if (computedErrors !== result.errorCount) {
    issues.push(`errorCount mismatch: reported ${result.errorCount}, computed ${computedErrors}`);
  }

  return { passed: issues.length === 0, issues };
}

export function validatePhaseResult(result: PhaseResult): IntegrityCheck {
  const issues: string[] = [];

  if (!result.phase)           issues.push('PhaseResult missing phase');
  if (!Array.isArray(result.errors))   issues.push('PhaseResult errors must be an array');
  if (!Array.isArray(result.warnings)) issues.push('PhaseResult warnings must be an array');
  if (result.durationMs < 0)   issues.push('Negative durationMs');

  if (!VALID_STATUSES.includes(result.status)) {
    issues.push(`Invalid phase status: ${result.status}`);
  }

  return { passed: issues.length === 0, issues };
}

export function validateStateTransition(
  from: VerificationStatus,
  to:   VerificationStatus,
): boolean {
  const TRANSITIONS: Record<VerificationStatus, VerificationStatus[]> = {
    pending:   ['running', 'cancelled'],
    running:   ['passed', 'failed', 'cancelled'],
    passed:    [],
    failed:    [],
    skipped:   [],
    cancelled: [],
  };
  return TRANSITIONS[from]?.includes(to) ?? false;
}
