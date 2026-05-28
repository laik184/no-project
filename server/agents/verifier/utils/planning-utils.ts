/**
 * utils/planning-utils.ts
 * Utility functions for verification planning.
 */

import type { VerificationPhase } from '../types/verifier.types.ts';
import type { ExecutionStep, RetryConfig } from '../types/execution.types.ts';
import { DEFAULT_RETRY_CONFIG, DEFAULT_STEP_TIMEOUT_MS } from '../types/execution.types.ts';
import { randomUUID } from 'node:crypto';

export const PHASE_ORDER: VerificationPhase[] = [
  'dependencies',
  'typecheck',
  'build',
  'runtime',
  'endpoints',
  'tests',
  'validation',
];

export function orderedPhases(requested: VerificationPhase[]): VerificationPhase[] {
  return PHASE_ORDER.filter((p) => requested.includes(p));
}

export function makeStep(
  phase:     VerificationPhase,
  toolName:  string,
  input:     Record<string, unknown>,
  opts:      { required?: boolean; timeoutMs?: number; retry?: Partial<RetryConfig> } = {},
): ExecutionStep {
  return {
    id:          randomUUID(),
    phase,
    toolName,
    input,
    required:    opts.required   ?? true,
    timeoutMs:   opts.timeoutMs  ?? DEFAULT_STEP_TIMEOUT_MS,
    retryPolicy: { ...DEFAULT_RETRY_CONFIG, ...opts.retry },
  };
}

export function isBlockingPhase(phase: VerificationPhase): boolean {
  return phase === 'typecheck' || phase === 'build' || phase === 'dependencies';
}

export function estimateTimeoutMs(phase: VerificationPhase): number {
  const timeouts: Record<VerificationPhase, number> = {
    dependencies: 30_000,
    typecheck:    60_000,
    build:        120_000,
    runtime:      30_000,
    endpoints:    30_000,
    tests:        120_000,
    validation:   30_000,
  };
  return timeouts[phase];
}

export function shouldSkipPhase(
  phase:           VerificationPhase,
  previousResults: Array<{ phase: VerificationPhase; status: string }>,
  stopOnFailure:   boolean,
): boolean {
  if (!stopOnFailure) return false;
  const phaseBefore = PHASE_ORDER.indexOf(phase);
  return previousResults.some((r) => {
    const rIdx = PHASE_ORDER.indexOf(r.phase);
    return rIdx < phaseBefore && r.status === 'failed';
  });
}
