/**
 * recovery/retry-recovery.ts
 * Coordinates retry decisions for failed verification phases.
 * Delegates actual retries to the execution layer.
 */

import type { VerificationPhase, PhaseResult } from '../types/verifier.types.ts';
import type { VerificationPlan } from '../planning/verification-planner.ts';
import { verifierLogger } from '../telemetry/verifier-logger.ts';
import { verifierMetrics } from '../telemetry/verifier-metrics.ts';

export interface RetryDecision {
  shouldRetry:  boolean;
  phase:        VerificationPhase;
  reason:       string;
  delayMs:      number;
  maxAttempts:  number;
}

const MAX_PHASE_RETRIES = 2;
const RETRY_DELAY_MS    = 2000;

const retryAttempts = new Map<string, Map<VerificationPhase, number>>();

function getAttempts(runId: string): Map<VerificationPhase, number> {
  if (!retryAttempts.has(runId)) retryAttempts.set(runId, new Map());
  return retryAttempts.get(runId)!;
}

export function decidePhaseRetry(
  runId:   string,
  result:  PhaseResult,
): RetryDecision {
  const phase    = result.phase;
  const attempts = getAttempts(runId);
  const count    = attempts.get(phase) ?? 0;

  if (count >= MAX_PHASE_RETRIES) {
    return { shouldRetry: false, phase, reason: 'max retries exhausted', delayMs: 0, maxAttempts: MAX_PHASE_RETRIES };
  }

  if (isNonRetryableFailure(result)) {
    return { shouldRetry: false, phase, reason: 'non-retryable failure (syntax/type errors)', delayMs: 0, maxAttempts: MAX_PHASE_RETRIES };
  }

  attempts.set(phase, count + 1);
  verifierLogger.info(runId, `Phase retry scheduled: ${phase}`, { attempt: count + 1 });
  verifierMetrics.increment(runId, `retry.${phase}`);

  return {
    shouldRetry:  true,
    phase,
    reason:       'transient failure — retrying',
    delayMs:      RETRY_DELAY_MS * (count + 1),
    maxAttempts:  MAX_PHASE_RETRIES,
  };
}

function isNonRetryableFailure(result: PhaseResult): boolean {
  const errorText = result.errors.join(' ').toLowerCase();
  return (
    result.phase === 'typecheck' ||
    errorText.includes('syntax error') ||
    errorText.includes('cannot find module') ||
    errorText.includes('permission denied')
  );
}

export function getRetryCount(runId: string, phase: VerificationPhase): number {
  return getAttempts(runId).get(phase) ?? 0;
}

export function clearRetries(runId: string): void {
  retryAttempts.delete(runId);
}
