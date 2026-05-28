/**
 * server/agents/supervisor/validation/execution-validator.ts
 *
 * Validates supervision execution lifecycle and orchestration transitions.
 * Detects invalid state transitions and corrupted execution flows.
 * Pure functions — no side effects, no tool calls.
 */

import type {
  ValidationResult,
  SupervisionPhase,
  SupervisionStatus,
  TaskOutcome,
} from '../types/supervisor.types.ts';

// ── Valid phase transitions ───────────────────────────────────────────────────

const VALID_TRANSITIONS: Readonly<Record<SupervisionPhase, ReadonlyArray<SupervisionPhase>>> = {
  idle:        ['validating', 'failed'],
  validating:  ['routing', 'failed'],
  routing:     ['supervising', 'failed'],
  supervising: ['retrying', 'escalating', 'completing', 'failed'],
  retrying:    ['supervising', 'escalating', 'failed'],
  escalating:  ['failed', 'completing'],
  completing:  ['idle'],
  failed:      ['idle'],
};

// ── Phase transition validation ───────────────────────────────────────────────

export function validatePhaseTransition(
  from: SupervisionPhase,
  to:   SupervisionPhase,
): ValidationResult {
  const allowed = VALID_TRANSITIONS[from] ?? [];
  const valid   = allowed.includes(to);
  return {
    valid,
    errors:   valid ? [] : [`Invalid phase transition: ${from} → ${to}`],
    warnings: [],
  };
}

// ── Execution lifecycle validation ────────────────────────────────────────────

export function validateExecutionLifecycle(
  runId:   string,
  status:  SupervisionStatus,
  phase:   SupervisionPhase,
  outcome: TaskOutcome,
): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!runId) {
    errors.push('runId is required for lifecycle validation');
  }

  if (status === 'aborted' || status === 'completed') {
    errors.push(`Cannot record outcome in terminal status "${status}"`);
  }

  if (phase === 'idle' || phase === 'validating') {
    errors.push(`Cannot record outcome during phase "${phase}"`);
  }

  if (!outcome.taskId) {
    errors.push('outcome.taskId is required');
  }

  if (typeof outcome.durationMs !== 'number' || outcome.durationMs < 0) {
    warnings.push('outcome.durationMs is missing or negative');
  }

  if (!outcome.success && !outcome.error) {
    warnings.push(`outcome for task[${outcome.taskId}] failed without an error message`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Orchestration flow integrity ──────────────────────────────────────────────

export function validateOrchestrationFlow(
  totalTasks:     number,
  completedTasks: number,
  failedTasks:    number,
): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (completedTasks > totalTasks) {
    errors.push(`completedTasks (${completedTasks}) exceeds totalTasks (${totalTasks}) — corrupted flow`);
  }

  if (failedTasks > completedTasks) {
    errors.push(`failedTasks (${failedTasks}) exceeds completedTasks (${completedTasks}) — corrupted flow`);
  }

  const failRate = completedTasks > 0 ? failedTasks / completedTasks : 0;
  if (failRate > 0.5) {
    warnings.push(`High failure rate: ${(failRate * 100).toFixed(0)}% of completed tasks failed`);
  }

  return { valid: errors.length === 0, errors, warnings };
}
