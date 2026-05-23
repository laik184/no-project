/**
 * server/infrastructure/recovery/retry-policy.ts  — P10 Recovery Hardening
 *
 * withRetry() — composable exponential-backoff retry for any async operation.
 *
 * Use when calling external services, I/O that can transiently fail, or any
 * operation that should retry before escalating to the RecoveryManager.
 *
 * Single responsibility: retry/backoff math + execution only.
 */

import { bus } from "../events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RetryPolicy {
  maxRetries:      number;
  initialDelayMs:  number;
  backoffFactor:   number;
  maxDelayMs:      number;
  jitterFactor?:   number;   // 0–1, adds ± jitter to avoid thundering herd
}

export interface RetryContext {
  operationId: string;
  runId?:      string;
  projectId?:  number;
}

export interface RetryResult<T> {
  ok:       boolean;
  value?:   T;
  error?:   Error;
  attempts: number;
}

// ── Built-in policies ─────────────────────────────────────────────────────────

export const FAST_RETRY: RetryPolicy = {
  maxRetries: 3, initialDelayMs: 200, backoffFactor: 2, maxDelayMs: 5_000, jitterFactor: 0.2,
};

export const SLOW_RETRY: RetryPolicy = {
  maxRetries: 5, initialDelayMs: 1_000, backoffFactor: 2, maxDelayMs: 60_000, jitterFactor: 0.3,
};

export const NO_RETRY: RetryPolicy = {
  maxRetries: 0, initialDelayMs: 0, backoffFactor: 1, maxDelayMs: 0,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeDelay(policy: RetryPolicy, attempt: number): number {
  const base  = policy.initialDelayMs * Math.pow(policy.backoffFactor, attempt);
  const delay = Math.min(base, policy.maxDelayMs);
  if (!policy.jitterFactor) return delay;
  const jitter = delay * policy.jitterFactor * (Math.random() * 2 - 1);
  return Math.max(0, delay + jitter);
}

function emitRetryEvent(ctx: RetryContext, attempt: number, error: string, delayMs: number): void {
  bus.emit("agent.event", {
    runId:     ctx.runId ?? ctx.operationId,
    projectId: ctx.projectId ?? -1,
    phase:     "recovery",
    agentName: "retry-policy",
    eventType: "retry.attempt",
    payload:   { operationId: ctx.operationId, attempt, error, delayMs },
    ts:        Date.now(),
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Execute `fn` with automatic retry + exponential backoff.
 * Returns a RetryResult — never throws.
 */
export async function withRetry<T>(
  fn:     () => Promise<T>,
  policy: RetryPolicy,
  ctx:    RetryContext,
): Promise<RetryResult<T>> {
  let attempts = 0;
  let lastErr:  Error = new Error("unknown");

  while (attempts <= policy.maxRetries) {
    try {
      const value = await fn();
      return { ok: true, value, attempts };
    } catch (err: unknown) {
      lastErr  = err instanceof Error ? err : new Error(String(err));
      attempts++;
      if (attempts > policy.maxRetries) break;
      const delay = computeDelay(policy, attempts - 1);
      emitRetryEvent(ctx, attempts, lastErr.message, delay);
      await new Promise<void>(r => setTimeout(r, delay));
    }
  }

  bus.emit("agent.event", {
    runId:     ctx.runId ?? ctx.operationId,
    projectId: ctx.projectId ?? -1,
    phase:     "recovery",
    agentName: "retry-policy",
    eventType: "retry.exhausted",
    payload:   { operationId: ctx.operationId, attempts, error: lastErr.message },
    ts:        Date.now(),
  });

  return { ok: false, error: lastErr, attempts };
}
