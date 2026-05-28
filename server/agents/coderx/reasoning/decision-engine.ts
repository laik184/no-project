/**
 * server/agents/coderx/reasoning/decision-engine.ts
 *
 * Controls reasoning decisions about how to proceed after each step result.
 * Pure decision logic — no execution, no dispatcher calls.
 */

import type {
  DecisionResult,
  DecisionOutcome,
  CoderXRetryConfig,
  RuntimeCodingStep,
} from '../types/coderx.types.ts';
import { isRetryableError } from '../utils/coding-utils.ts';

// ── Primary decision entry point ──────────────────────────────────────────────

export function decide(
  step:        RuntimeCodingStep,
  retryConfig: CoderXRetryConfig,
  stopOnFailure: boolean,
): DecisionResult {
  if (step.status === 'completed') {
    return { outcome: 'continue', reason: 'Step completed successfully.' };
  }

  if (step.status === 'failed') {
    return decideOnFailure(step, retryConfig, stopOnFailure);
  }

  if (step.status === 'skipped') {
    return { outcome: 'continue', reason: 'Step was skipped — optional or dependency absent.' };
  }

  return { outcome: 'continue', reason: `Step status: ${step.status}` };
}

// ── Failure decision ──────────────────────────────────────────────────────────

function decideOnFailure(
  step:          RuntimeCodingStep,
  retryConfig:   CoderXRetryConfig,
  stopOnFailure: boolean,
): DecisionResult {
  const error   = step.error ?? 'unknown error';
  const retries = step.retryCount;

  if (!isRetryableError(error)) {
    return resolveNonRetryable(error, stopOnFailure, step.step.optional);
  }

  if (retries < retryConfig.maxAttempts - 1) {
    return {
      outcome: 'retry',
      reason:  `Retryable failure (attempt ${retries + 1}/${retryConfig.maxAttempts}): ${error}`,
    };
  }

  return resolveExhausted(error, stopOnFailure, step.step.optional);
}

function resolveNonRetryable(
  error:         string,
  stopOnFailure: boolean,
  optional:      boolean | undefined,
): DecisionResult {
  if (optional) {
    return { outcome: 'skip', reason: `Non-retryable error on optional step: ${error}` };
  }
  const outcome: DecisionOutcome = stopOnFailure ? 'abort' : 'continue';
  return { outcome, reason: `Non-retryable error: ${error}` };
}

function resolveExhausted(
  error:         string,
  stopOnFailure: boolean,
  optional:      boolean | undefined,
): DecisionResult {
  if (optional) {
    return { outcome: 'skip', reason: `Retries exhausted on optional step: ${error}` };
  }
  const outcome: DecisionOutcome = stopOnFailure ? 'abort' : 'continue';
  return { outcome, reason: `Retries exhausted: ${error}` };
}

// ── Plan-level decision ───────────────────────────────────────────────────────

export function shouldAbortPlan(
  failedCount:   number,
  totalCount:    number,
  stopOnFailure: boolean,
): boolean {
  if (stopOnFailure && failedCount > 0) return true;
  const failureRate = totalCount > 0 ? failedCount / totalCount : 0;
  return failureRate > 0.5;
}
