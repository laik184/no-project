/**
 * server/quantum/execution/execution-retry.ts
 *
 * Exponential-backoff retry engine for pool task execution.
 * Fail-closed: exhausted retries always propagate the last error — no silent drops.
 * Telemetry: emits worker.retry for every reattempt.
 */

import { emitWorkerRetry } from "../telemetry/worker-telemetry.ts";

// ── Configuration ─────────────────────────────────────────────────────────────

export interface RetryOptions {
  taskId:      string;
  runId:       string;
  maxAttempts: number;           // total attempts including first try
  baseDelayMs: number;           // initial backoff delay
  maxDelayMs:  number;           // cap on delay growth
  factor:      number;           // backoff multiplier (2 = exponential)
  /** Optional: classify whether an error is retryable. Default: always retry. */
  isRetryable?: (err: Error, attempt: number) => boolean;
}

export interface RetryResult<T> {
  value:      T | null;
  success:    boolean;
  attempts:   number;
  lastError?: string;
}

const DEFAULT_RETRY_OPTIONS: Omit<RetryOptions, "taskId" | "runId"> = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs:  30_000,
  factor:      2,
};

// ── Retry engine ──────────────────────────────────────────────────────────────

export async function withRetry<T>(
  fn:   () => Promise<T>,
  opts: RetryOptions,
): Promise<RetryResult<T>> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...opts };
  let attempt  = 0;
  let lastError: Error | undefined;

  while (attempt < config.maxAttempts) {
    try {
      const value = await fn();
      return { value, success: true, attempts: attempt + 1 };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      attempt++;

      if (attempt >= config.maxAttempts) break;

      // Check retryability
      if (config.isRetryable && !config.isRetryable(lastError, attempt)) {
        break;
      }

      const delayMs = computeDelay(attempt, config.baseDelayMs, config.maxDelayMs, config.factor);

      emitWorkerRetry(config.runId, {
        taskId:     config.taskId,
        runId:      config.runId,
        attempt,
        maxRetries: config.maxAttempts - 1,
        delayMs,
      });

      await sleep(delayMs);
    }
  }

  return {
    value:     null,
    success:   false,
    attempts:  attempt,
    lastError: lastError?.message ?? "Unknown error",
  };
}

// ── Backoff calculator ────────────────────────────────────────────────────────

function computeDelay(
  attempt:     number,
  baseDelayMs: number,
  maxDelayMs:  number,
  factor:      number,
): number {
  const raw   = baseDelayMs * Math.pow(factor, attempt - 1);
  const jitter = Math.random() * 0.2 * raw;  // ±10% jitter to avoid thundering herd
  return Math.min(maxDelayMs, Math.floor(raw + jitter));
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ── Non-retryable error classifier ────────────────────────────────────────────

/** Standard classifier: never retry cancellations or hard configuration errors. */
export function defaultIsRetryable(err: Error): boolean {
  const msg = err.message.toLowerCase();
  if (msg.includes("cancel") || msg.includes("aborted"))  return false;
  if (msg.includes("pool_exhausted"))                      return false;
  if (msg.includes("queue_overflow"))                      return false;
  return true;
}
