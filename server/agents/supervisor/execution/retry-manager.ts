/**
 * server/agents/supervisor/execution/retry-manager.ts
 *
 * Manages retry logic for the supervisor agent orchestration layer.
 * Pure orchestration — no tool calls, no direct execution.
 */

import type { RetryPolicy, RecoveryAction, AgentDomain } from '../types/supervisor.types.ts';
import { backoffMs, sleep, decideRecovery }  from '../utils/supervision-utils.ts';
import { supervisorLogger }                  from '../telemetry/supervisor-logger.ts';
import { supervisorMetrics }                 from '../telemetry/supervisor-metrics.ts';
import { failureMonitor }                    from '../monitoring/failure-monitor.ts';

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

// ── Retry context ─────────────────────────────────────────────────────────────

export interface RetryContext {
  runId:  string;
  taskId: string;
  domain: AgentDomain;
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
  const { runId, taskId, domain, policy } = ctx;
  let lastError = '';
  let attempts  = 0;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    attempts = attempt;
    try {
      const result = await fn();
      if (isSuccess(result)) {
        return { value: result, success: true, attempts, action: 'ok' };
      }
      lastError = 'Task result marked as failure';
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    const action = decideRecovery(lastError);

    if (action === 'abort' || action === 'skip' || action === 'escalate') {
      supervisorLogger.warn(runId, `task[${taskId}] action=${action} after attempt ${attempt}`, {
        error: lastError, domain,
      });
      failureMonitor.recordFailure(runId, taskId, domain, lastError, attempt);
      return { success: false, attempts, lastError, action };
    }

    if (attempt < policy.maxAttempts) {
      const delay = computeDelay(policy, attempt);
      supervisorLogger.retry(runId, taskId, attempt, lastError);
      supervisorMetrics.recordRetry(runId);
      failureMonitor.recordRetry(runId);
      await sleep(delay);
    }
  }

  failureMonitor.recordFailure(runId, taskId, domain, lastError, attempts);
  return { success: false, attempts, lastError, action: 'abort' };
}

// ── Policy selector ───────────────────────────────────────────────────────────

export function policyForDomain(domain: AgentDomain): RetryPolicy {
  switch (domain) {
    case 'planner':
      return { maxAttempts: 2, delayMs: 1_000, backoff: 'exponential' };
    case 'executor':
      return { maxAttempts: 3, delayMs: 500,   backoff: 'exponential' };
    case 'verifier':
      return { maxAttempts: 2, delayMs: 500,   backoff: 'linear' };
    case 'browser':
      return { maxAttempts: 2, delayMs: 1_000, backoff: 'linear' };
    case 'filesystem':
      return { maxAttempts: 2, delayMs: 300,   backoff: 'linear' };
    case 'terminal':
      return { maxAttempts: 2, delayMs: 1_000, backoff: 'exponential' };
    default:
      return DEFAULT_RETRY_POLICY;
  }
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
