/**
 * server/agents/browser/execution/retry-manager.ts
 *
 * Centralized retry logic for the browser agent execution layer.
 * Classifies errors, computes backoff, and controls retry eligibility.
 */

import { toErrorMessage, isTimeoutError, isCrashError, sleep }
  from '../utils/browser-utils.ts';

export interface RetryConfig {
  maxAttempts: number;
  delayMs:     number;
  backoff:     'none' | 'linear' | 'exponential';
}

export interface RetryState {
  attempt:   number;
  maxAttempts: number;
  lastError?: string;
  exhausted: boolean;
}

export const DEFAULT_RETRY: RetryConfig = {
  maxAttempts: 3,
  delayMs:     800,
  backoff:     'exponential',
};

export const NO_RETRY: RetryConfig = {
  maxAttempts: 1,
  delayMs:     0,
  backoff:     'none',
};

// ── Error classification ──────────────────────────────────────────────────────

export function isRetryable(error: string): boolean {
  if (isCrashError(error))    return false; // Session is gone — no point retrying
  if (/PERMISSION_DENIED/i.test(error)) return false;
  if (/INVALID_INPUT/i.test(error))     return false;
  if (/NAV_BLOCKED/i.test(error))       return false;
  return true;
}

export function isFatal(error: string): boolean {
  return isCrashError(error) ||
    /registry is sealed/i.test(error) ||
    /no active session/i.test(error);
}

// ── Backoff calculation ───────────────────────────────────────────────────────

export function computeDelay(attempt: number, config: RetryConfig): number {
  if (config.backoff === 'exponential') {
    return config.delayMs * Math.pow(2, attempt - 1);
  }
  if (config.backoff === 'linear') {
    return config.delayMs * attempt;
  }
  return 0;
}

// ── Retry executor ────────────────────────────────────────────────────────────

export async function withRetry<T>(
  fn:     () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY,
  label?: string,
): Promise<{ result: T; retries: number }> {
  let lastErr: unknown;
  let retries = 0;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      const result = await fn();
      return { result, retries };
    } catch (err) {
      lastErr = err;
      const msg = toErrorMessage(err);

      if (!isRetryable(msg) || attempt === config.maxAttempts) break;

      retries++;
      const delay = computeDelay(attempt, config);
      if (delay > 0) await sleep(delay);

      if (label) {
        console.warn(`[retry-manager] Retrying "${label}" (attempt ${attempt + 1}/${config.maxAttempts})`);
      }
    }
  }

  throw lastErr;
}

// ── State helpers ─────────────────────────────────────────────────────────────

export function makeRetryState(config: RetryConfig): RetryState {
  return { attempt: 0, maxAttempts: config.maxAttempts, exhausted: false };
}

export function advanceRetry(state: RetryState, error: string): RetryState {
  const attempt = state.attempt + 1;
  return {
    ...state,
    attempt,
    lastError: error,
    exhausted: attempt >= state.maxAttempts,
  };
}
