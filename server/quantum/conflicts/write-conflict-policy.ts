/**
 * write-conflict-policy.ts
 *
 * Retry and backoff policy for the parallel write coordinator.
 * Isolated from conflict detection and ownership logic.
 *
 * Single responsibility: compute retry decisions and delays for write conflicts.
 */

// ── Config ────────────────────────────────────────────────────────────────────

export interface ConflictRetryConfig {
  maxRetries:   number;
  baseDelayMs:  number;
  maxDelayMs:   number;
}

export const DEFAULT_CONFLICT_RETRY_CONFIG: ConflictRetryConfig = {
  maxRetries:  3,
  baseDelayMs: 500,
  maxDelayMs:  30_000,
};

// ── Decision ──────────────────────────────────────────────────────────────────

export interface ConflictRetryDecision {
  shouldRetry: boolean;
  delayMs:     number;
  reason:      string;
}

/**
 * Determine whether a write conflict should be retried.
 * Pure function — no side effects.
 */
export function evaluateConflictRetry(
  attempt: number,
  error:   string,
  config:  ConflictRetryConfig = DEFAULT_CONFLICT_RETRY_CONFIG,
): ConflictRetryDecision {
  if (attempt >= config.maxRetries) {
    return {
      shouldRetry: false,
      delayMs:     0,
      reason:      `max conflict retries (${config.maxRetries}) exhausted`,
    };
  }

  if (isNonRetryableConflict(error)) {
    return {
      shouldRetry: false,
      delayMs:     0,
      reason:      `non-retryable conflict: ${error}`,
    };
  }

  return {
    shouldRetry: true,
    delayMs:     backoffDelay(attempt, config),
    reason:      `retryable conflict on attempt ${attempt}`,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function backoffDelay(
  attempt: number,
  config:  ConflictRetryConfig = DEFAULT_CONFLICT_RETRY_CONFIG,
): number {
  return Math.min(config.maxDelayMs, config.baseDelayMs * Math.pow(2, attempt - 1));
}

const NON_RETRYABLE = [
  /run_cancelled/i,
  /policy blocked/i,
  /ambiguous ownership/i,
  /invalid ownership/i,
  /validation failed/i,
];

export function isNonRetryableConflict(error: string): boolean {
  return NON_RETRYABLE.some(p => p.test(error));
}

export function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
