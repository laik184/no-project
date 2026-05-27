import type { VerificationPhase, VerificationStatus } from '../shared/verifier-types.ts';
import type { RecoveryDecision }                       from './failure-recovery.ts';

export type RetryReason = 'transient_error' | 'resource_busy' | 'network_error' | 'timeout' | 'none';

export interface RetryDecision {
  shouldRetry:  boolean;
  reason:       RetryReason;
  delayMs:      number;
  maxAttempts:  number;
}

const RETRYABLE_ERRORS = [
  /ECONNREFUSED/,
  /ETIMEDOUT/,
  /EADDRINUSE/,
  /socket hang up/i,
  /timed out/i,
  /temporarily unavailable/i,
];

export function shouldRetryPhase(
  phase:   VerificationPhase,
  error:   string,
  attempt: number,
): RetryDecision {
  const maxAttempts = phase === 'runtime' || phase === 'endpoints' ? 3 : 1;
  if (attempt >= maxAttempts) {
    return { shouldRetry: false, reason: 'none', delayMs: 0, maxAttempts };
  }

  for (const p of RETRYABLE_ERRORS) {
    if (p.test(error)) {
      return {
        shouldRetry: true,
        reason:      p.source.includes('ETIMEDOUT') || p.source.includes('timed out') ? 'timeout' : 'network_error',
        delayMs:     1_000 * attempt,
        maxAttempts,
      };
    }
  }

  return { shouldRetry: false, reason: 'none', delayMs: 0, maxAttempts };
}

export function recoveryToRetry(decision: RecoveryDecision): RetryDecision {
  return {
    shouldRetry: decision.action === 'retry',
    reason:      'transient_error',
    delayMs:     decision.retryIn ?? 1_000,
    maxAttempts: 3,
  };
}
