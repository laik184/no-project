/**
 * planning/build-plan.ts
 * Produces ExecutionSteps for build, typecheck, and dependency phases.
 */

import type { VerificationPhase, VerificationInput } from '../types/verifier.types.ts';
import type { ExecutionStep } from '../types/execution.types.ts';
import { makeStep, estimateTimeoutMs } from '../utils/planning-utils.ts';
import { VERIFIER_TOOLS } from '../coordination/tool-coordinator.ts';

export function buildPhasePlan(
  phase: VerificationPhase,
  input: VerificationInput,
): ExecutionStep[] {
  const base = { projectId: input.projectId, sandboxRoot: input.sandboxRoot };

  switch (phase) {
    case 'dependencies':
      return dependencySteps(base);

    case 'typecheck':
      return typecheckSteps(base, input);

    case 'build':
      return buildSteps(base, input);

    default:
      return [];
  }
}

function dependencySteps(base: Record<string, unknown>): ExecutionStep[] {
  return [
    makeStep('dependencies', VERIFIER_TOOLS.DEP_VALIDATE, base, {
      required:  true,
      timeoutMs: estimateTimeoutMs('dependencies'),
    }),
  ];
}

function typecheckSteps(
  base:  Record<string, unknown>,
  input: VerificationInput,
): ExecutionStep[] {
  return [
    makeStep('typecheck', VERIFIER_TOOLS.RUN_TYPECHECK, base, {
      required:  true,
      timeoutMs: estimateTimeoutMs('typecheck'),
    }),
    makeStep('typecheck', VERIFIER_TOOLS.PARSE_TYPECHECK, base, {
      required:  false,
      timeoutMs: 15_000,
    }),
    makeStep('typecheck', VERIFIER_TOOLS.CLASSIFY_TS_ERRORS, base, {
      required:  false,
      timeoutMs: 10_000,
    }),
    makeStep('typecheck', VERIFIER_TOOLS.VALIDATE_TYPECHECK, base, {
      required:  false,
      timeoutMs: 10_000,
    }),
  ];
}

function buildSteps(
  base:  Record<string, unknown>,
  input: VerificationInput,
): ExecutionStep[] {
  return [
    makeStep('build', VERIFIER_TOOLS.BUILD, base, {
      required:  true,
      timeoutMs: estimateTimeoutMs('build'),
      retry:     { maxAttempts: 1, delayMs: 0, backoff: 'none' },
    }),
    makeStep('build', VERIFIER_TOOLS.PARSE_BUILD, base, {
      required:  false,
      timeoutMs: 15_000,
    }),
    makeStep('build', VERIFIER_TOOLS.BUILD_ERRORS, base, {
      required:  false,
      timeoutMs: 10_000,
    }),
    makeStep('build', VERIFIER_TOOLS.OUTPUT_VALIDATE, base, {
      required:  false,
      timeoutMs: 10_000,
    }),
  ];
}
