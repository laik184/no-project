/**
 * server/engine/reflection/retry-strategy.ts
 *
 * Retry strategy selector for the Reflection Engine.
 *
 * Single responsibility: given a classified failure, compute the retry strategy
 * (exponential backoff, delay, max attempts). Does NOT execute retries.
 *
 * Integrates with retry-guard.ts (which tracks attempt counts) and
 * reuses the retry vocabulary from server/policies/runtime/retry-policy.ts
 * without tight coupling to it.
 */

import type { ReflectionFailureClass } from "./reflection-types.ts";

// ── Strategy definition ───────────────────────────────────────────────────────

export interface RetryStrategy {
  id:              string;
  name:            string;
  maxAttempts:     number;
  baseDelayMs:     number;
  maxDelayMs:      number;
  backoffFactor:   number;
  requiresRestart: boolean;
}

// ── Strategy table ────────────────────────────────────────────────────────────

const STRATEGIES: Record<ReflectionFailureClass, RetryStrategy> = {
  runtime_crash: {
    id: "runtime_crash", name: "Crash recovery restart",
    maxAttempts: 2, baseDelayMs: 3_000, maxDelayMs: 15_000,
    backoffFactor: 2, requiresRestart: true,
  },
  memory_leak: {
    id: "memory_leak", name: "Memory leak restart",
    maxAttempts: 1, baseDelayMs: 5_000, maxDelayMs: 5_000,
    backoffFactor: 1, requiresRestart: true,
  },
  port_conflict: {
    id: "port_conflict", name: "Port conflict — stop then start",
    maxAttempts: 2, baseDelayMs: 2_000, maxDelayMs: 6_000,
    backoffFactor: 2, requiresRestart: true,
  },
  port_timeout: {
    id: "port_timeout", name: "Port readiness wait + retry",
    maxAttempts: 3, baseDelayMs: 5_000, maxDelayMs: 20_000,
    backoffFactor: 2, requiresRestart: false,
  },
  dependency_missing: {
    id: "dependency_missing", name: "npm install then restart",
    maxAttempts: 2, baseDelayMs: 2_000, maxDelayMs: 8_000,
    backoffFactor: 2, requiresRestart: true,
  },
  process_exit: {
    id: "process_exit", name: "Process restart",
    maxAttempts: 3, baseDelayMs: 2_000, maxDelayMs: 10_000,
    backoffFactor: 2, requiresRestart: true,
  },
  timeout: {
    id: "timeout", name: "Timeout retry with backoff",
    maxAttempts: 2, baseDelayMs: 5_000, maxDelayMs: 20_000,
    backoffFactor: 2.5, requiresRestart: false,
  },
  preview_proxy_failure: {
    id: "preview_proxy_failure", name: "Preview proxy retry",
    maxAttempts: 3, baseDelayMs: 3_000, maxDelayMs: 12_000,
    backoffFactor: 2, requiresRestart: false,
  },
  hydration_failure: {
    id: "hydration_failure", name: "Hydration fix — no restart",
    maxAttempts: 1, baseDelayMs: 2_000, maxDelayMs: 2_000,
    backoffFactor: 1, requiresRestart: false,
  },
  verification_failure: {
    id: "verification_failure", name: "Verification retry",
    maxAttempts: 2, baseDelayMs: 3_000, maxDelayMs: 10_000,
    backoffFactor: 2, requiresRestart: false,
  },
  preview_blank: {
    id: "preview_blank", name: "Preview reload retry",
    maxAttempts: 2, baseDelayMs: 4_000, maxDelayMs: 12_000,
    backoffFactor: 2, requiresRestart: false,
  },
  // Non-retryable — maxAttempts=0 signals abort
  syntax_error:         { id: "syntax_error",         name: "Fix syntax — no retry",      maxAttempts: 0, baseDelayMs: 0, maxDelayMs: 0, backoffFactor: 1, requiresRestart: false },
  typescript_error:     { id: "typescript_error",     name: "Fix TS errors — no retry",   maxAttempts: 0, baseDelayMs: 0, maxDelayMs: 0, backoffFactor: 1, requiresRestart: false },
  build_failure:        { id: "build_failure",        name: "Fix build — no retry",        maxAttempts: 0, baseDelayMs: 0, maxDelayMs: 0, backoffFactor: 1, requiresRestart: false },
  infinite_render_loop: { id: "infinite_render_loop", name: "Fix render loop — no retry", maxAttempts: 0, baseDelayMs: 0, maxDelayMs: 0, backoffFactor: 1, requiresRestart: false },
  tool_loop:            { id: "tool_loop",            name: "Break tool loop — no retry", maxAttempts: 0, baseDelayMs: 0, maxDelayMs: 0, backoffFactor: 1, requiresRestart: false },
  unknown:              { id: "unknown",              name: "Unknown failure — no retry",  maxAttempts: 0, baseDelayMs: 0, maxDelayMs: 0, backoffFactor: 1, requiresRestart: false },
};

// ── Public API ────────────────────────────────────────────────────────────────

export function getRetryStrategy(failureClass: ReflectionFailureClass): RetryStrategy {
  return STRATEGIES[failureClass] ?? STRATEGIES.unknown;
}

/**
 * Compute exponential backoff delay for attempt N (0-indexed).
 */
export function computeDelay(strategy: RetryStrategy, attempt: number): number {
  const raw = strategy.baseDelayMs * Math.pow(strategy.backoffFactor, attempt);
  return Math.min(raw, strategy.maxDelayMs);
}

/**
 * Whether a retry is allowed given the strategy and current attempt count.
 */
export function isRetryAllowed(
  strategy: RetryStrategy,
  currentAttempts: number,
): boolean {
  return strategy.maxAttempts > 0 && currentAttempts < strategy.maxAttempts;
}
