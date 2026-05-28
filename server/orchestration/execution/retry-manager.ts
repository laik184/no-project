/**
 * server/orchestration/execution/retry-manager.ts
 *
 * Controls orchestration-level retry strategy and backoff computation.
 * Pure retry coordination — no tool execution, no filesystem access.
 */

import type {
  OrchestrationRetryConfig,
  DecisionResult,
  PhaseResult,
} from '../types/orchestration.types.ts';
import { computeRetryDelay, sleep, decideOnFailure } from '../utils/orchestration-utils.ts';

// ── Default config ────────────────────────────────────────────────────────────

export const DEFAULT_RETRY_CONFIG: OrchestrationRetryConfig = {
  maxAttempts: 3,
  delayMs:     500,
  backoff:     'exponential',
};

// ── Retry state ───────────────────────────────────────────────────────────────

export interface RetryState {
  phaseId:     string;
  attempt:     number;
  maxAttempts: number;
  lastError?:  string;
  exhausted:   boolean;
}

// ── State factory ─────────────────────────────────────────────────────────────

export function createRetryState(
  phaseId:    string,
  config:     OrchestrationRetryConfig = DEFAULT_RETRY_CONFIG,
): RetryState {
  return {
    phaseId,
    attempt:     1,
    maxAttempts: config.maxAttempts,
    lastError:   undefined,
    exhausted:   false,
  };
}

// ── Retry advancement ─────────────────────────────────────────────────────────

export function advanceRetry(
  state:  RetryState,
  error:  string,
): RetryState {
  const nextAttempt = state.attempt + 1;
  return {
    ...state,
    attempt:   nextAttempt,
    lastError: error,
    exhausted: nextAttempt > state.maxAttempts,
  };
}

export function canRetry(state: RetryState): boolean {
  return !state.exhausted;
}

// ── Delay application ─────────────────────────────────────────────────────────

export async function applyRetryDelay(
  attempt: number,
  config:  OrchestrationRetryConfig,
): Promise<void> {
  const delay = computeRetryDelay(attempt, config);
  if (delay > 0) await sleep(delay);
}

// ── Decision builder ──────────────────────────────────────────────────────────

export function buildRetryDecision(
  result:   PhaseResult,
  state:    RetryState,
  optional: boolean,
): DecisionResult {
  if (result.ok) {
    return { outcome: 'continue', reason: `Phase ${result.phaseId} completed successfully` };
  }

  const outcome = decideOnFailure(state.attempt - 1, state.maxAttempts, optional);
  const reason  = result.error ?? 'Unknown phase error';

  switch (outcome) {
    case 'retry':
      return {
        outcome: 'retry',
        reason:  `Retrying phase ${result.phaseId} (attempt ${state.attempt}/${state.maxAttempts}): ${reason}`,
      };
    case 'skip':
      return {
        outcome: 'skip',
        reason:  `Skipping optional phase ${result.phaseId}: ${reason}`,
      };
    default:
      return {
        outcome: 'abort',
        reason:  `Phase ${result.phaseId} exhausted retries (${state.maxAttempts} attempts): ${reason}`,
      };
  }
}

// ── Remaining budget ──────────────────────────────────────────────────────────

export function remainingAttempts(state: RetryState): number {
  return Math.max(0, state.maxAttempts - state.attempt + 1);
}
