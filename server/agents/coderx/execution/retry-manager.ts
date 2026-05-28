/**
 * server/agents/coderx/execution/retry-manager.ts
 *
 * Manages retry logic for failed coding steps.
 * Controls delay computation and retry eligibility — no execution.
 */

import type { CoderXRetryConfig } from '../types/coderx.types.ts';
import { computeRetryDelay, isRetryableError, sleep } from '../utils/coding-utils.ts';
import { coderxLogger }  from '../telemetry/coderx-logger.ts';
import { coderxMetrics } from '../telemetry/coderx-metrics.ts';
import { executionHistory } from '../memory/execution-history.ts';

export const DEFAULT_RETRY_CONFIG: CoderXRetryConfig = {
  maxAttempts: 3,
  delayMs:     500,
  backoff:     'exponential',
};

// ── Retry eligibility ─────────────────────────────────────────────────────────

export function canRetry(
  error:       string,
  retryCount:  number,
  config:      CoderXRetryConfig,
): boolean {
  if (!isRetryableError(error)) return false;
  return retryCount < config.maxAttempts - 1;
}

// ── Delay and wait ────────────────────────────────────────────────────────────

export async function waitForRetry(
  runId:      string,
  stepId:     string,
  taskId:     string,
  attempt:    number,
  error:      string,
  config:     CoderXRetryConfig,
): Promise<void> {
  const delayMs = computeRetryDelay(attempt, config.delayMs, config.backoff);

  coderxLogger.stepRetrying(runId, stepId, attempt, delayMs);
  coderxMetrics.recordRetry(runId);
  executionHistory.recordRetry(runId, stepId, taskId, attempt, error);

  if (delayMs > 0) await sleep(delayMs);
}

// ── Max attempts accessor ─────────────────────────────────────────────────────

export function maxAttemptsFor(config: CoderXRetryConfig): number {
  return config.maxAttempts;
}
