/**
 * planning/validation-plan.ts
 * Produces ExecutionSteps for test and validation phases.
 */

import type { VerificationPhase, VerificationInput } from '../types/verifier.types.ts';
import type { ExecutionStep } from '../types/execution.types.ts';
import { makeStep, estimateTimeoutMs } from '../utils/planning-utils.ts';
import { VERIFIER_TOOLS } from '../coordination/tool-coordinator.ts';

export function validationPhasePlan(
  phase: VerificationPhase,
  input: VerificationInput,
): ExecutionStep[] {
  const base = { projectId: input.projectId, sandboxRoot: input.sandboxRoot };

  switch (phase) {
    case 'tests':
      return testSteps(base, input);

    case 'validation':
      return validationSteps(base);

    default:
      return [];
  }
}

function testSteps(
  base:  Record<string, unknown>,
  input: VerificationInput,
): ExecutionStep[] {
  return [
    makeStep('tests', VERIFIER_TOOLS.RUN_TESTS, base, {
      required:  false,
      timeoutMs: estimateTimeoutMs('tests'),
      retry:     { maxAttempts: 1, delayMs: 0, backoff: 'none' },
    }),
    makeStep('tests', VERIFIER_TOOLS.PARSE_TESTS, base, {
      required:  false,
      timeoutMs: 15_000,
    }),
    makeStep('tests', VERIFIER_TOOLS.CLASSIFY_FAILURES, base, {
      required:  false,
      timeoutMs: 10_000,
    }),
    makeStep('tests', VERIFIER_TOOLS.COVERAGE, base, {
      required:  false,
      timeoutMs: 10_000,
    }),
  ];
}

function validationSteps(base: Record<string, unknown>): ExecutionStep[] {
  return [
    makeStep('validation', VERIFIER_TOOLS.SCHEMA_VALIDATE, base, {
      required:  false,
      timeoutMs: 15_000,
    }),
    makeStep('validation', VERIFIER_TOOLS.EXEC_VALIDATE, base, {
      required:  false,
      timeoutMs: 10_000,
    }),
    makeStep('validation', VERIFIER_TOOLS.VERIFY_VALIDATE, base, {
      required:  false,
      timeoutMs: 10_000,
    }),
  ];
}
