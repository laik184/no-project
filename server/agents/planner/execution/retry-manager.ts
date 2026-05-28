/**
 * server/agents/planner/execution/retry-manager.ts
 *
 * Manages retry logic for the planner agent orchestration layer.
 * Pure orchestration — no tool calls, no direct execution.
 */

import type { RetryPolicy, RecoveryAction } from '../types/planner.types.ts';
import { backoffMs, sleep, decideRecovery } from '../utils/planning-utils.ts';
import { plannerLogger }                    from '../telemetry/planner-logger.ts';
import { plannerMetrics }                   from '../telemetry/planner-metrics.ts';
import { planningMonitor }                  from '../monitoring/planning-monitor.ts';

// ── Default policies ──────────────────────────────────────────────────────────

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

export const PLANNING_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 2,
  delayMs:     1_000,
  backoff:     'exponential',
};

// ── Retry context ─────────────────────────────────────────────────────────────

export interface RetryContext {
  runId:  string;
  taskId: string;
  phase:  string;
  policy: RetryPolicy;
}

export interface RetryResult<T> {
  value?:     T;
  success:    boolean;
  attempts:   number;
  lastError?: string;
  action:     RecoveryAction | 'ok';
}

// ── Core retry wrapper ────────────────────────────────────────────────────────

export async function withRetry<T>(
  fn:        () => Promise<T>,
  ctx:       RetryContext,
  isSuccess: (result: T) => boolean = () => true,
): Promise<RetryResult<T>> {
  const { runId, taskId, phase, policy } = ctx;
  let lastError = '';
  let attempts  = 0;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    attempts = attempt;
    try {
      const result = await fn();
      if (isSuccess(result)) {
        return { value: result, success: true, attempts, action: 'ok' };
      }
      lastError = 'Planning step result marked as failure';
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    const action = decideRecovery(lastError);

    if (action === 'abort' || action === 'skip' || action === 'escalate') {
      plannerLogger.warn(runId, `task[${taskId}] action=${action} after attempt ${attempt}`, {
        error: lastError, phase,
      });
      planningMonitor.recordFailure(runId, phase, lastError, attempt);
      return { success: false, attempts, lastError, action };
    }

    if (attempt < policy.maxAttempts) {
      const delay = computeDelay(policy, attempt);
      plannerLogger.retry(runId, taskId, attempt, lastError);
      plannerMetrics.recordRetry(runId);
      planningMonitor.recordRetry(runId);
      await sleep(delay);
    }
  }

  planningMonitor.recordFailure(runId, phase, lastError, attempts);
  return { success: false, attempts, lastError, action: 'abort' };
}

// ── Private helpers ───────────────────────────────────────────────────────────

function computeDelay(policy: RetryPolicy, attempt: number): number {
  switch (policy.backoff) {
    case 'exponential': return backoffMs(attempt, policy.delayMs);
    case 'linear':      return policy.delayMs * attempt;
    case 'none':
    default:            return 0;
  }
}
