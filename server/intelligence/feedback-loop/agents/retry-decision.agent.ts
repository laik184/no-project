import type { EvaluationResult, RetryDecision } from '../types.ts';
import type { FeedbackLoopState as StateShape } from '../state.ts';
import {
  maxAttemptsGuard,
  pickRetryStrategy,
  retryDelayMs,
  shouldRetryOnSeverity,
} from '../utils/retry-policy.util.ts';

function buildReason(
  evaluation: EvaluationResult,
  state: StateShape,
  willRetry: boolean,
): string {
  if (!willRetry) {
    if (!maxAttemptsGuard(state.attempts, state.maxAttempts)) {
      return `Max attempts (${state.maxAttempts}) reached — stopping`;
    }
    if (evaluation.passed) {
      return `Output passed evaluation with score ${evaluation.score.toFixed(2)} — no retry needed`;
    }
    return `Severity "${evaluation.severity}" blocks further retry at attempt ${state.attempts}`;
  }
  return `Score ${evaluation.score.toFixed(2)} below threshold — retrying with strategy to improve quality`;
}

export function decideRetry(
  evaluation: EvaluationResult,
  state: StateShape,
): RetryDecision {
  const withinLimit = maxAttemptsGuard(state.attempts, state.maxAttempts);
  const severityAllows = shouldRetryOnSeverity(evaluation.severity, state.attempts, state.maxAttempts);
  const shouldRetry = withinLimit && severityAllows && !evaluation.passed;

  const strategy = shouldRetry
    ? pickRetryStrategy(evaluation.score, state.attempts, state.maxAttempts)
    : 'fallback';

  const delayMs = shouldRetry ? retryDelayMs(strategy) : 0;
  const nextAttempt = state.attempts + 1;
  const reason = buildReason(evaluation, state, shouldRetry);

  return Object.freeze({
    shouldRetry,
    strategy,
    reason,
    nextAttempt,
    delayMs,
  });
}
