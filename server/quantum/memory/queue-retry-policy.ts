/**
 * queue-retry-policy.ts
 *
 * Deterministic retry delay and decision logic for the memory write queue.
 * Single responsibility: given an attempt number and config, compute delay.
 *
 * Isolated from queue execution — no side effects, no I/O, pure functions.
 */

// ── Config ────────────────────────────────────────────────────────────────────

export interface RetryConfig {
  maxRetries:    number;
  baseDelayMs:   number;
  maxDelayMs:    number;
  jitterFactor?: number;   // 0–1; adds randomness to prevent thundering herd
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries:   3,
  baseDelayMs:  200,
  maxDelayMs:   5_000,
  jitterFactor: 0.2,
};

// ── Retry decision ────────────────────────────────────────────────────────────

export interface RetryDecision {
  shouldRetry: boolean;
  delayMs:     number;
  reason:      string;
}

/**
 * Determine whether a failed attempt should be retried and after what delay.
 * Pure function — deterministic given the same inputs (jitter aside).
 */
export function evaluateRetry(
  attempt:   number,
  error:     string,
  config:    RetryConfig = DEFAULT_RETRY_CONFIG,
): RetryDecision {
  if (attempt >= config.maxRetries) {
    return {
      shouldRetry: false,
      delayMs:     0,
      reason:      `max retries (${config.maxRetries}) exhausted after: ${error}`,
    };
  }

  if (isNonRetryableError(error)) {
    return {
      shouldRetry: false,
      delayMs:     0,
      reason:      `non-retryable error: ${error}`,
    };
  }

  const delayMs = computeDelay(attempt, config);
  return {
    shouldRetry: true,
    delayMs,
    reason:      `retryable error on attempt ${attempt}: ${error}`,
  };
}

// ── Delay computation ─────────────────────────────────────────────────────────

/**
 * Exponential back-off with optional jitter.
 * delay = min(base * 2^attempt, max) ± jitter%
 */
export function computeDelay(
  attempt: number,
  config:  RetryConfig = DEFAULT_RETRY_CONFIG,
): number {
  const base  = config.baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(base, config.maxDelayMs);
  if (!config.jitterFactor) return capped;

  const jitter = capped * config.jitterFactor * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(capped + jitter));
}

// ── Non-retryable error classification ───────────────────────────────────────

const NON_RETRYABLE_PATTERNS = [
  /aborted/i,
  /cancelled/i,
  /invalid ownership/i,
  /policy blocked/i,
  /lock ownership mismatch/i,
  /ambiguous ownership/i,
  /queue corrupted/i,
];

export function isNonRetryableError(error: string): boolean {
  return NON_RETRYABLE_PATTERNS.some(p => p.test(error));
}

// ── Sleep helper ──────────────────────────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
