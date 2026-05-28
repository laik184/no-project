/**
 * server/agents/verifier/execution/retry-manager.ts
 * Retry orchestration for the verifier agent. No direct execution.
 */

import type { RetryPolicy, RecoveryAction } from '../types/verifier.types.ts';
import { verifierLogger }  from '../telemetry/verifier-logger.ts';
import { verifierMetrics } from '../telemetry/verifier-metrics.ts';
import { failureMonitor }  from '../monitoring/failure-monitor.ts';
import { sleep, backoffMs, isRetryableError } from '../utils/verification-utils.ts';

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  delayMs:     1_000,
  backoff:     'exponential',
};

export const NO_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 1,
  delayMs:     0,
  backoff:     'none',
};

export interface RetryContext {
  runId:  string;
  stepId: string;
  policy: RetryPolicy;
}

export interface RetryResult<T> {
  value?:     T;
  success:    boolean;
  attempts:   number;
  lastError?: string;
  action:     RecoveryAction | 'ok';
}

export async function withRetry<T>(
  fn:        () => Promise<T>,
  ctx:       RetryContext,
  isSuccess: (result: T) => boolean = () => true,
): Promise<RetryResult<T>> {
  const { runId, stepId, policy } = ctx;
  let lastError = '';
  let attempts  = 0;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    attempts = attempt;
    try {
      const result = await fn();
      if (isSuccess(result)) {
        return { value: result, success: true, attempts, action: 'ok' };
      }
      lastError = 'Step result marked as failure';
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    if (!isRetryableError(lastError)) {
      verifierLogger.warn(runId, `Step ${stepId}: non-retryable error — aborting`, { error: lastError });
      failureMonitor.recordFailure(runId, stepId, 'retry', lastError, attempt);
      return { success: false, attempts, lastError, action: 'abort' };
    }

    if (attempt < policy.maxAttempts) {
      const delay = computeDelay(policy, attempt);
      verifierLogger.retry(runId, stepId, attempt, lastError);
      verifierMetrics.recordRetry(runId);
      failureMonitor.recordRetry(runId);
      await sleep(delay);
    }
  }

  failureMonitor.recordFailure(runId, stepId, 'retry', lastError, attempts);
  return { success: false, attempts, lastError, action: 'abort' };
}

function computeDelay(policy: RetryPolicy, attempt: number): number {
  switch (policy.backoff) {
    case 'exponential': return backoffMs(attempt, policy.delayMs);
    case 'linear':      return policy.delayMs * attempt;
    default:            return 0;
  }
}

export function policyForStepType(stepType: string): RetryPolicy {
  switch (stepType) {
    case 'run_build':
    case 'run_typecheck':
      return { maxAttempts: 1, delayMs: 0, backoff: 'none' };
    case 'run_tests':
      return { maxAttempts: 1, delayMs: 0, backoff: 'none' };
    case 'check_server_health':
    case 'validate_runtime':
      return { maxAttempts: 3, delayMs: 2_000, backoff: 'linear' };
    case 'validate_dependencies':
      return { maxAttempts: 1, delayMs: 0, backoff: 'none' };
    case 'checkpoint':
      return NO_RETRY_POLICY;
    default:
      return DEFAULT_RETRY_POLICY;
  }
}
