/**
 * server/orchestration/validation/integrity-validator.ts
 *
 * Validates orchestration flow integrity: lifecycle transitions,
 * corrupted state detection, and structural coherence checks.
 * Pure validation — no side effects, no tool execution.
 */

import type {
  OrchestrationSession,
  OrchestrationStatus,
  ValidationResult,
} from '../types/orchestration.types.ts';

// ── Terminal states ───────────────────────────────────────────────────────────

const TERMINAL_STATES = new Set<OrchestrationStatus>([
  'completed',
  'cancelled',
]);

// ── Lifecycle integrity ───────────────────────────────────────────────────────

export function validateLifecycleTransition(
  from: OrchestrationStatus,
  to:   OrchestrationStatus,
): ValidationResult {
  if (TERMINAL_STATES.has(from)) {
    return {
      valid:  false,
      errors: [`Cannot transition from terminal state "${from}" to "${to}"`],
    };
  }

  const ALLOWED: Record<OrchestrationStatus, OrchestrationStatus[]> = {
    idle:      ['planning'],
    planning:  ['running', 'failed', 'cancelled'],
    running:   ['completed', 'failed', 'paused', 'escalated', 'cancelled'],
    paused:    ['running', 'cancelled'],
    escalated: ['running', 'failed', 'cancelled'],
    failed:    ['running'],
    completed: [],
    cancelled: [],
  };

  const allowed = ALLOWED[from] ?? [];
  if (!allowed.includes(to)) {
    return {
      valid:  false,
      errors: [
        `Integrity violation: illegal lifecycle transition "${from}" → "${to}". ` +
        `Allowed: [${allowed.join(', ') || 'none'}]`,
      ],
    };
  }

  return { valid: true, errors: [] };
}

// ── Session integrity ─────────────────────────────────────────────────────────

export function validateSessionIntegrity(session: OrchestrationSession): ValidationResult {
  const errors: string[] = [];

  if (!session.sessionId)       errors.push('session.sessionId is missing');
  if (!session.orchestrationId) errors.push('session.orchestrationId is missing');
  if (!session.runId)           errors.push('session.runId is missing');
  if (!session.projectId)       errors.push('session.projectId is missing');

  if (session.workflowsDone > session.workflowsTotal) {
    errors.push(
      `session.workflowsDone (${session.workflowsDone}) exceeds workflowsTotal (${session.workflowsTotal})`,
    );
  }
  if (session.workflowsDone < 0 || session.workflowsTotal < 0) {
    errors.push('session workflow counts must be non-negative');
  }

  if (TERMINAL_STATES.has(session.status) && !session.endedAt) {
    errors.push(`session in terminal state "${session.status}" is missing endedAt timestamp`);
  }
  if (session.endedAt && session.endedAt < session.startedAt) {
    errors.push('session.endedAt cannot be before startedAt');
  }

  return { valid: errors.length === 0, errors };
}

// ── Flow coherence ────────────────────────────────────────────────────────────

export function validateFlowCoherence(
  orchestrationId: string,
  workflowsDone:   number,
  workflowsTotal:  number,
  status:          OrchestrationStatus,
): ValidationResult {
  const errors: string[] = [];

  if (workflowsDone > workflowsTotal) {
    errors.push(
      `[${orchestrationId}] workflowsDone (${workflowsDone}) exceeds workflowsTotal (${workflowsTotal})`,
    );
  }

  if (status === 'completed' && workflowsDone !== workflowsTotal) {
    errors.push(
      `[${orchestrationId}] Orchestration marked completed but only ${workflowsDone}/${workflowsTotal} workflows are done`,
    );
  }

  if (status === 'idle' && workflowsDone > 0) {
    errors.push(
      `[${orchestrationId}] Orchestration is idle but has ${workflowsDone} completed workflows — possible state corruption`,
    );
  }

  return { valid: errors.length === 0, errors };
}
