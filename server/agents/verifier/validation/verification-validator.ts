/**
 * validation/verification-validator.ts
 * Validates VerificationInput and VerificationPlan integrity.
 * Pure orchestration-layer validation — no tool calls.
 */

import type { VerificationInput, VerificationPhase } from '../types/verifier.types.ts';
import type { VerificationPlan } from '../planning/verification-planner.ts';

export interface ValidationResult {
  valid:    boolean;
  errors:   string[];
  warnings: string[];
}

const VALID_PHASES: VerificationPhase[] = [
  'dependencies', 'typecheck', 'build', 'runtime', 'endpoints', 'tests', 'validation',
];

export function validateVerificationInput(input: VerificationInput): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!input.runId?.trim())       errors.push('runId is required');
  if (!input.projectId?.trim())   errors.push('projectId is required');
  if (!input.sandboxRoot?.trim()) errors.push('sandboxRoot is required');

  if (!Array.isArray(input.phases) || input.phases.length === 0) {
    errors.push('At least one verification phase is required');
  } else {
    for (const phase of input.phases) {
      if (!VALID_PHASES.includes(phase)) {
        errors.push(`Unknown phase: "${phase}"`);
      }
    }
  }

  if (input.phases?.includes('endpoints') && !input.endpoints?.length) {
    warnings.push('Phase "endpoints" requested but no endpoints specified');
  }

  if (input.timeoutMs !== undefined && input.timeoutMs < 5000) {
    warnings.push('Timeout is very low (< 5s) — some tools may not complete');
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validatePlan(plan: VerificationPlan): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!plan.steps.length) warnings.push('Plan has no steps — verification will be empty');

  const phasesCovered = new Set(plan.steps.map((s) => s.phase));
  for (const phase of plan.phases) {
    if (!phasesCovered.has(phase)) {
      warnings.push(`Phase "${phase}" has no steps planned`);
    }
  }

  const duplicateIds = plan.steps.filter((s, i) =>
    plan.steps.findIndex((x) => x.id === s.id) !== i,
  );
  if (duplicateIds.length) {
    errors.push(`Duplicate step IDs: ${duplicateIds.map((s) => s.id).join(', ')}`);
  }

  return { valid: errors.length === 0, errors, warnings };
}
