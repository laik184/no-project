/**
 * planning/verification-planner.ts
 * Produces a VerificationPlan from a VerificationInput.
 * Pure orchestration — decides WHAT to verify, not HOW.
 */

import type { VerificationInput, VerificationPhase } from '../types/verifier.types.ts';
import type { ExecutionPlan, ExecutionStep } from '../types/execution.types.ts';
import { orderedPhases, shouldSkipPhase, estimateTimeoutMs } from '../utils/planning-utils.ts';
import { DEFAULT_VERIFICATION_CONFIG } from '../types/verifier.types.ts';
import { buildPhasePlan } from './build-plan.ts';
import { runtimePhasePlan } from './runtime-plan.ts';
import { validationPhasePlan } from './validation-plan.ts';

export interface VerificationPlan {
  runId:       string;
  projectId:   string;
  sandboxRoot: string;
  phases:      VerificationPhase[];
  steps:       ExecutionStep[];
  stopOnFailure: boolean;
  totalTimeoutMs: number;
}

export function buildVerificationPlan(input: VerificationInput): VerificationPlan {
  const config    = DEFAULT_VERIFICATION_CONFIG;
  const phases    = orderedPhases(input.phases);
  const allSteps: ExecutionStep[] = [];

  for (const phase of phases) {
    const steps = resolveStepsForPhase(phase, input);
    allSteps.push(...steps);
  }

  const totalTimeoutMs = input.timeoutMs ?? phases.reduce((sum, p) => sum + estimateTimeoutMs(p), 0);

  return {
    runId:          input.runId,
    projectId:      input.projectId,
    sandboxRoot:    input.sandboxRoot,
    phases,
    steps:          allSteps,
    stopOnFailure:  config.stopOnFailure,
    totalTimeoutMs,
  };
}

function resolveStepsForPhase(
  phase:  VerificationPhase,
  input:  VerificationInput,
): ExecutionStep[] {
  switch (phase) {
    case 'typecheck':
    case 'build':
    case 'dependencies':
      return buildPhasePlan(phase, input);
    case 'runtime':
    case 'endpoints':
      return runtimePhasePlan(phase, input);
    case 'tests':
    case 'validation':
      return validationPhasePlan(phase, input);
    default:
      return [];
  }
}

export function planSummary(plan: VerificationPlan): string {
  return `${plan.phases.length} phase(s), ${plan.steps.length} step(s), timeout ${plan.totalTimeoutMs}ms`;
}

export function filterSkippedPhases(
  plan:        VerificationPlan,
  completed:   Array<{ phase: VerificationPhase; status: string }>,
): VerificationPhase[] {
  return plan.phases.filter(
    (p) => !shouldSkipPhase(p, completed, plan.stopOnFailure),
  );
}

export function planToExecutionPlan(plan: VerificationPlan): ExecutionPlan {
  return {
    runId:   plan.runId,
    steps:   plan.steps,
    ordered: true,
  };
}
