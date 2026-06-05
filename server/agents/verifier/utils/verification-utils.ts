/**
 * server/agents/verifier/utils/verification-utils.ts
 * Helper utilities for the verifier agent orchestration layer.
 */

import type { VerificationStep, VerificationStepType, VerificationPhase } from '../types/verifier.types.ts';

let _counter = 0;

export function makeRunId(): string {
  return `vrf-${Date.now()}-${(++_counter).toString(36)}`;
}

export function makeStepId(phase: VerificationPhase, type: VerificationStepType): string {
  return `${phase}:${type}:${Date.now().toString(36)}`;
}

export function elapsedMs(start: Date): number {
  return Date.now() - start.getTime();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function backoffMs(attempt: number, base: number): number {
  return Math.min(base * Math.pow(2, attempt - 1), 30_000);
}

export function defaultSteps(
  runId:     string,
  projectId: string,
  phases:    VerificationPhase[],
): VerificationStep[] {
  const steps: VerificationStep[] = [];

  const push = (
    phase:     VerificationPhase,
    type:      VerificationStepType,
    label:     string,
    input:     Record<string, unknown>,
    critical   = true,
    timeoutMs  = 120_000,
    retryLimit = 2,
  ) => steps.push({ id: makeStepId(phase, type), type, phase, label, input, timeoutMs, retryLimit, critical });

  if (phases.includes('dependencies')) {
    push('dependencies', 'validate_dependencies', 'Validate dependencies', { runId, projectId }, true, 10_000, 1);
  }
  if (phases.includes('typecheck')) {
    push('typecheck', 'run_typecheck', 'Run TypeScript type-check', { runId, projectId }, true, 60_000, 1);
  }
  if (phases.includes('build')) {
    push('build', 'run_build', 'Run build', { runId, projectId }, true, 120_000, 1);
  }
  if (phases.includes('tests')) {
    push('tests', 'run_tests', 'Run tests', { runId, projectId }, false, 120_000, 1);
  }
  if (phases.includes('runtime')) {
    push('runtime', 'check_server_health', 'Check server health', { runId }, false, 15_000, 2);
  }
  if (phases.includes('endpoints')) {
    push('endpoints', 'validate_endpoints', 'Validate endpoints', { runId, endpoints: [] }, false, 30_000, 1);
  }

  return steps;
}

export function isRetryableError(error: string): boolean {
  const NON_RETRYABLE = [
    /syntax error/i, /permission denied/i, /enospc/i,
    /network unreachable/i, /enoent.*package\.json/i,
  ];
  return !NON_RETRYABLE.some((p) => p.test(error));
}
