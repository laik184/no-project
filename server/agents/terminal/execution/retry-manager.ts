/**
 * server/agents/terminal/execution/retry-manager.ts
 *
 * Manages retry logic for the terminal agent orchestration layer.
 * Pure orchestration — no tool calls, no direct execution.
 */

import type { RetryPolicy, RecoveryAction } from '../types/terminal.types.ts';
import { backoffMs, sleep, decideRecovery } from '../utils/execution-utils.ts';
import { terminalLogger }  from '../telemetry/terminal-logger.ts';
import { terminalMetrics } from '../telemetry/terminal-metrics.ts';
import { failureMonitor }  from '../monitoring/failure-monitor.ts';

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  delayMs:     500,
  backoff:     'exponential',
};

export const NO_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 1,
  delayMs:     0,
  backoff:     'none',
};

// ── Core retry wrapper ────────────────────────────────────────────────────────

export interface RetryContext {
  runId:   string;
  stepId:  string;
  policy:  RetryPolicy;
}

export interface RetryResult<T> {
  value?:      T;
  success:     boolean;
  attempts:    number;
  lastError?:  string;
  action:      RecoveryAction | 'ok';
}

export async function withRetry<T>(
  fn:  () => Promise<T>,
  ctx: RetryContext,
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

    const action = decideRecovery(lastError);

    if (action === 'abort' || action === 'skip') {
      terminalLogger.warn(runId, `Step ${stepId}: action=${action} after attempt ${attempt}`, { error: lastError });
      failureMonitor.recordFailure(runId, stepId, 'retry', lastError, attempt);
      return { success: false, attempts, lastError, action };
    }

    if (attempt < policy.maxAttempts) {
      const delay = computeDelay(policy, attempt);
      terminalLogger.retry(runId, stepId, attempt, lastError);
      terminalMetrics.recordRetry(runId);
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
    case 'none':
    default:            return 0;
  }
}

// ── Policy selector ───────────────────────────────────────────────────────────

export function policyForStepType(stepType: string): RetryPolicy {
  switch (stepType) {
    case 'npm_install':
    case 'npm_build':
      return { maxAttempts: 2, delayMs: 2_000, backoff: 'linear' };
    case 'run_command':
    case 'npm_run':
    case 'npm_test':
      return { maxAttempts: 2, delayMs: 1_000, backoff: 'exponential' };
    case 'write_file':
    case 'read_file':
    case 'patch_file':
      return { maxAttempts: 2, delayMs: 300, backoff: 'linear' };
    case 'checkpoint':
    case 'validate_output':
      return NO_RETRY_POLICY;
    default:
      return DEFAULT_RETRY_POLICY;
  }
}
