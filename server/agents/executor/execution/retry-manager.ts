/**
 * server/agents/executor/execution/retry-manager.ts
 *
 * Centralized retry management for the executor agent.
 * Controls backoff, max attempts, and retry eligibility.
 * No execution logic — pure retry orchestration.
 */

import type { ExecutorRetryConfig } from '../types/executor.types.ts';
import { computeRetryDelay, toErrorMessage, isRetryableError } from '../utils/execution-utils.ts';

// ── Default config ────────────────────────────────────────────────────────────

export const DEFAULT_RETRY_CONFIG: ExecutorRetryConfig = {
  maxAttempts: 3,
  delayMs:     800,
  backoff:     'exponential',
};

// ── Retry result ──────────────────────────────────────────────────────────────

export interface RetryResult<T> {
  ok:       boolean;
  data?:    T;
  error?:   string;
  attempts: number;
}

// ── Core runner ───────────────────────────────────────────────────────────────

/**
 * Execute an async fn with retry logic.
 * Non-retryable errors abort immediately.
 * Retryable errors are retried with configured backoff.
 */
export async function withRetry<T>(
  fn:       () => Promise<T>,
  config:   ExecutorRetryConfig = DEFAULT_RETRY_CONFIG,
  onRetry?: (attempt: number, error: string, delayMs: number) => void,
): Promise<RetryResult<T>> {
  let lastError = '';
  let attempt   = 0;

  while (attempt < config.maxAttempts) {
    attempt++;
    try {
      const data = await fn();
      return { ok: true, data, attempts: attempt };
    } catch (err) {
      lastError = toErrorMessage(err);

      if (!isRetryableError(lastError)) {
        return { ok: false, error: lastError, attempts: attempt };
      }

      if (attempt < config.maxAttempts) {
        const delayMs = computeRetryDelay(attempt, config.delayMs, config.backoff);
        onRetry?.(attempt, lastError, delayMs);
        if (delayMs > 0) {
          await new Promise<void>((r) => setTimeout(r, delayMs));
        }
      }
    }
  }

  return { ok: false, error: lastError, attempts: attempt };
}
