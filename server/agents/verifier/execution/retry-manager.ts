/**
 * execution/retry-manager.ts
 * Manages retry scheduling for failed step dispatches.
 * Orchestration only — no direct execution.
 */

import type { RetryConfig } from '../types/execution.types.ts';
import { delay } from '../utils/execution-utils.ts';
import { verifierMetrics } from '../telemetry/verifier-metrics.ts';
import { eventPublisher } from '../events/event-publisher.ts';
import type { VerificationPhase } from '../types/verifier.types.ts';

export interface RetryContext {
  runId:    string;
  toolName: string;
  phase:    VerificationPhase;
}

export interface RetryDecision {
  shouldRetry: boolean;
  attempt:     number;
  delayMs:     number;
  reason?:     string;
}

export function shouldRetry(
  attempt:      number,
  error:        string,
  retryConfig:  RetryConfig,
): RetryDecision {
  if (attempt >= retryConfig.maxAttempts) {
    return { shouldRetry: false, attempt, delayMs: 0, reason: 'max attempts reached' };
  }

  if (isNonRetryableError(error)) {
    return { shouldRetry: false, attempt, delayMs: 0, reason: 'non-retryable error' };
  }

  const delayMs = computeDelay(attempt, retryConfig);
  return { shouldRetry: true, attempt: attempt + 1, delayMs };
}

function computeDelay(attempt: number, config: RetryConfig): number {
  switch (config.backoff) {
    case 'exponential': return config.delayMs * Math.pow(2, attempt - 1);
    case 'linear':      return config.delayMs * attempt;
    default:            return 0;
  }
}

function isNonRetryableError(error: string): boolean {
  const nonRetryable = [
    'PERMISSION_DENIED',
    'NOT_FOUND',
    'syntax error',
    'cannot find module',
  ];
  return nonRetryable.some((e) => error.toLowerCase().includes(e.toLowerCase()));
}

export async function waitForRetry(
  ctx:     RetryContext,
  attempt: number,
  delayMs: number,
): Promise<void> {
  verifierMetrics.recordRetry(ctx.runId, ctx.toolName);
  eventPublisher.retryScheduled(ctx.runId, ctx.toolName, attempt, delayMs);
  if (delayMs > 0) await delay(delayMs);
}

export async function withRetry<T>(
  fn:      (attempt: number) => Promise<T>,
  ctx:     RetryContext,
  config:  RetryConfig,
  isOk:    (result: T) => boolean,
  getError:(result: T) => string,
): Promise<{ result: T; attempts: number }> {
  let attempt = 1;

  while (true) {
    const result = await fn(attempt);

    if (isOk(result)) return { result, attempts: attempt };

    const decision = shouldRetry(attempt, getError(result), config);
    if (!decision.shouldRetry) return { result, attempts: attempt };

    await waitForRetry(ctx, decision.attempt, decision.delayMs);
    attempt = decision.attempt;
  }
}
