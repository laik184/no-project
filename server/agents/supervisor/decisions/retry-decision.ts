import type { OrchestrationPhase } from '../../../orchestration/events/event-types.ts';
import type { SupervisorDecision, ExecutionMode } from '../types/supervisor.types.ts';

const PHASE_MAX_RETRIES: Partial<Record<OrchestrationPhase, number>> = {
  analyze:      2,
  planning:     2,
  execution:    3,
  verification: 3,
  browser:      1,
};

const NON_RETRYABLE_MESSAGES = [
  'unauthorized', 'forbidden', '401', '403',
  'quota exceeded', 'rate limit', 'invalid api key',
];

function isNonRetryableError(error: string): boolean {
  const lower = error.toLowerCase();
  return NON_RETRYABLE_MESSAGES.some((m) => lower.includes(m));
}

function maxRetriesFor(phase: OrchestrationPhase, mode: ExecutionMode): number {
  const base = PHASE_MAX_RETRIES[phase] ?? 2;
  return mode === 'complex' ? base + 1 : base;
}

export const retryDecision = {
  shouldRetry(
    phase: OrchestrationPhase,
    error: string,
    currentRetry: number,
    mode: ExecutionMode,
  ): SupervisorDecision {
    if (isNonRetryableError(error)) {
      return {
        action: 'escalate',
        reason: `Non-retryable error on phase "${phase}": ${error}`,
        metadata: { phase, error, currentRetry },
      };
    }

    const max = maxRetriesFor(phase, mode);
    if (currentRetry >= max) {
      return {
        action: 'escalate',
        reason: `Max retries (${max}) exhausted for phase "${phase}"`,
        metadata: { phase, currentRetry, max },
      };
    }

    return {
      action: 'retry',
      reason: `Retrying phase "${phase}" (attempt ${currentRetry + 1}/${max})`,
      metadata: { phase, currentRetry, max, delay: computeRetryDelay(currentRetry) },
    };
  },

  maxRetries(phase: OrchestrationPhase, mode: ExecutionMode): number {
    return maxRetriesFor(phase, mode);
  },

  retryDelay(attempt: number): number {
    return computeRetryDelay(attempt);
  },
};

function computeRetryDelay(attempt: number): number {
  const base = 1_000;
  const jitter = Math.random() * 500;
  return Math.min(base * Math.pow(2, attempt) + jitter, 30_000);
}
