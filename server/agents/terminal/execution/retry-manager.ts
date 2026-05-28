/**
 * server/agents/terminal/execution/retry-manager.ts
 *
 * Centralized retry logic for the terminal agent.
 * Applies backoff policy and emits telemetry on retries.
 */

import { retryDelay, sleep, toErrorMessage } from '../utils/execution-utils.ts';
import { terminalLogger }                    from '../telemetry/terminal-logger.ts';
import { failureMonitor }                    from '../monitoring/failure-monitor.ts';
import type { StepRetryPolicy }              from '../types/terminal.types.ts';

const DEFAULT_POLICY: StepRetryPolicy = {
  maxAttempts: 2,
  delayMs:     500,
  backoff:     'linear',
};

/**
 * Execute an async operation with retry + backoff.
 * Records failures via failureMonitor.
 * Returns { result, attempts } on success; throws on final failure.
 */
export async function withRetry<T>(
  fn:       () => Promise<T>,
  runId:    string,
  stepId:   string,
  policy:   StepRetryPolicy = DEFAULT_POLICY,
): Promise<{ result: T; attempts: number }> {
  let lastErr: unknown;
  let attempts = 0;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      const result = await fn();
      return { result, attempts: attempt };
    } catch (err) {
      lastErr  = err;
      attempts = attempt;

      const msg = toErrorMessage(err);
      failureMonitor.record(runId, stepId, msg, attempt);

      if (attempt < policy.maxAttempts) {
        const delay = retryDelay(attempt, policy.delayMs, policy.backoff);
        terminalLogger.warn(runId, `[retry] Step ${stepId} — attempt ${attempt} failed, retrying in ${delay}ms`, { error: msg });
        if (delay > 0) await sleep(delay);
      }
    }
  }

  throw lastErr;
}

/**
 * Non-throwing retry — returns null on exhaustion.
 */
export async function withRetryOrNull<T>(
  fn:     () => Promise<T>,
  runId:  string,
  stepId: string,
  policy: StepRetryPolicy = DEFAULT_POLICY,
): Promise<{ result: T; attempts: number } | null> {
  try {
    return await withRetry(fn, runId, stepId, policy);
  } catch {
    return null;
  }
}
