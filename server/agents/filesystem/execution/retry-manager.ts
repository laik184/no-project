/**
 * server/agents/filesystem/execution/retry-manager.ts
 *
 * Centralized retry management for the filesystem agent.
 * Controls backoff, max attempts, and retry eligibility.
 * No operation execution — pure retry orchestration logic.
 */

import type { FilesystemRetryConfig } from '../types/filesystem.types.ts';
export type { FilesystemRetryConfig };
import { computeDelay, toErrorMessage } from '../utils/filesystem-utils.ts';

// ── Default retry config ──────────────────────────────────────────────────────

export const DEFAULT_RETRY_CONFIG: FilesystemRetryConfig = {
  maxAttempts: 3,
  delayMs:     500,
  backoff:     'exponential',
};

// ── Error classification ──────────────────────────────────────────────────────

const NON_RETRYABLE_PATTERNS = [
  /permission denied/i,
  /path traversal/i,
  /blocked segment/i,
  /invalid.*path/i,
  /not allowed/i,
  /validation.*failed/i,
  /missing.*required/i,
];

export function isRetryable(error: string): boolean {
  return !NON_RETRYABLE_PATTERNS.some((re) => re.test(error));
}

// ── Retry state ───────────────────────────────────────────────────────────────

export interface RetryState {
  attempts:   number;
  lastError:  string | null;
  exhausted:  boolean;
}

export function initialRetryState(): RetryState {
  return { attempts: 0, lastError: null, exhausted: false };
}

// ── Core retry runner ─────────────────────────────────────────────────────────

export interface RetryResult<T> {
  ok:       boolean;
  data?:    T;
  error?:   string;
  attempts: number;
}

/**
 * Execute an async operation with retry logic.
 * Non-retryable errors (validation, permission) abort immediately.
 * Retryable errors (timeout, IO) are retried with configured backoff.
 *
 * @param fn      - The async operation to attempt
 * @param config  - Retry configuration (defaults to DEFAULT_RETRY_CONFIG)
 * @param onRetry - Optional callback invoked before each retry
 */
export async function withRetry<T>(
  fn:      () => Promise<T>,
  config:  FilesystemRetryConfig = DEFAULT_RETRY_CONFIG,
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

      if (!isRetryable(lastError)) {
        return { ok: false, error: lastError, attempts: attempt };
      }

      if (attempt < config.maxAttempts) {
        const delayMs = computeDelay(attempt, config.delayMs, config.backoff);
        onRetry?.(attempt, lastError, delayMs);
        if (delayMs > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }
  }

  return { ok: false, error: lastError, attempts: attempt };
}
