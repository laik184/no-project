/**
 * server/agents/browser/validation/integrity-validator.ts
 *
 * Validates execution flow integrity and automation transition correctness.
 * Detects: corrupted flows, invalid transitions, stuck loops.
 */

import type { StepResult } from '../execution/step-runner.ts';

export interface IntegrityReport {
  ok:          boolean;
  violations:  IntegrityViolation[];
  summary:     string;
}

export interface IntegrityViolation {
  rule:    string;
  detail:  string;
  severity: 'error' | 'warn';
}

// ── Rules ─────────────────────────────────────────────────────────────────────

const MAX_CONSECUTIVE_FAILURES = 3;
const MAX_TOTAL_STEPS           = 50;
const MAX_DUPLICATE_STEPS       = 5;

// ── Validators ────────────────────────────────────────────────────────────────

function checkConsecutiveFailures(steps: StepResult[]): IntegrityViolation | null {
  let consecutive = 0;
  for (const step of steps) {
    if (!step.ok) consecutive++;
    else consecutive = 0;
    if (consecutive >= MAX_CONSECUTIVE_FAILURES) {
      return {
        rule:     'consecutive-failures',
        detail:   `${consecutive} consecutive step failures detected`,
        severity: 'error',
      };
    }
  }
  return null;
}

function checkStepLimit(steps: StepResult[]): IntegrityViolation | null {
  if (steps.length > MAX_TOTAL_STEPS) {
    return {
      rule:     'step-limit-exceeded',
      detail:   `Execution has ${steps.length} steps, limit is ${MAX_TOTAL_STEPS}`,
      severity: 'error',
    };
  }
  return null;
}

function checkDuplicateSteps(steps: StepResult[]): IntegrityViolation | null {
  const counts = new Map<string, number>();
  for (const step of steps) {
    const key = step.kind;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const [kind, count] of counts) {
    if (count >= MAX_DUPLICATE_STEPS) {
      return {
        rule:     'duplicate-steps',
        detail:   `Step "${kind}" repeated ${count} times — possible loop`,
        severity: 'warn',
      };
    }
  }
  return null;
}

function checkNoEmptyFlow(steps: StepResult[]): IntegrityViolation | null {
  if (steps.length === 0) {
    return {
      rule:     'empty-flow',
      detail:   'Execution completed with zero steps',
      severity: 'warn',
    };
  }
  return null;
}

// ── Composite check ───────────────────────────────────────────────────────────

export function validateFlowIntegrity(steps: StepResult[]): IntegrityReport {
  const violations: IntegrityViolation[] = [];

  const rules = [
    checkNoEmptyFlow,
    checkConsecutiveFailures,
    checkStepLimit,
    checkDuplicateSteps,
  ];

  for (const rule of rules) {
    const v = rule(steps);
    if (v) violations.push(v);
  }

  const errors = violations.filter(v => v.severity === 'error');
  return {
    ok:         errors.length === 0,
    violations,
    summary:    violations.length === 0
      ? 'Flow integrity validated'
      : violations.map(v => `[${v.severity}] ${v.detail}`).join('; '),
  };
}
