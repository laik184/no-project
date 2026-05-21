/**
 * server/verification/typescript/retry-policy-engine.ts
 *
 * RetryPolicyEngine — decides whether and when to retry.
 * COMPILER_ERROR is NEVER retried. Only infrastructure failures get retries.
 * No mutable shared state. Pure decision logic.
 */

import type { FailureClassification } from "./types.ts";

export interface RetryDecision {
  readonly shouldRetry: boolean;
  readonly delayMs: number;
  readonly reason: string;
}

export interface RetryContext {
  readonly attempt: number;
  readonly maxRetries: number;
  readonly classification: FailureClassification;
}

// ─── Per-class jitter-free backoff delays (ms) ────────────────────────────────

const BACKOFF_MS: Record<string, number[]> = {
  SPAWN_FAILURE:    [500, 1500],
  TIMEOUT:          [2000],
  FILESYSTEM_ERROR: [300, 800],
  MEMORY_ERROR:     [1000, 3000],
};

export class RetryPolicyEngine {
  decide(ctx: RetryContext): RetryDecision {
    const { attempt, maxRetries, classification } = ctx;

    if (!classification.retryable) {
      return {
        shouldRetry: false,
        delayMs: 0,
        reason: `Failure class ${classification.class} is not retryable: ${classification.reason}`,
      };
    }

    if (attempt >= maxRetries) {
      return {
        shouldRetry: false,
        delayMs: 0,
        reason: `Retry budget exhausted (${attempt}/${maxRetries}).`,
      };
    }

    const backoffs = BACKOFF_MS[classification.class] ?? [500];
    const delayMs = backoffs[Math.min(attempt, backoffs.length - 1)];

    return {
      shouldRetry: true,
      delayMs,
      reason: `Retryable failure (${classification.class}), attempt ${attempt + 1}/${maxRetries}. Waiting ${delayMs}ms.`,
    };
  }

  async wait(ms: number, signal?: AbortSignal): Promise<void> {
    if (ms <= 0) return;
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      const onAbort = () => {
        clearTimeout(timer);
        reject(new Error("Retry wait cancelled"));
      };
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }
}
