import type { EvaluationResult, LoopStatus } from './types.ts';

const MAX_HISTORY = 20;

export interface FeedbackLoopState {
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly history: readonly EvaluationResult[];
  readonly lastScore: number;
  readonly status: LoopStatus;
}

export function createInitialState(maxAttempts: number): FeedbackLoopState {
  return Object.freeze({
    attempts: 0,
    maxAttempts,
    history: Object.freeze([]),
    lastScore: 0,
    status: 'RUNNING' as LoopStatus,
  });
}

export function withAttempt(
  state: FeedbackLoopState,
  evaluation: EvaluationResult,
): FeedbackLoopState {
  const updatedHistory = Object.freeze(
    [...state.history, evaluation].slice(-MAX_HISTORY),
  );
  return Object.freeze({
    ...state,
    attempts: state.attempts + 1,
    history: updatedHistory,
    lastScore: evaluation.score,
  });
}

export function withStatus(
  state: FeedbackLoopState,
  status: LoopStatus,
): FeedbackLoopState {
  return Object.freeze({ ...state, status });
}

export function isExhausted(state: FeedbackLoopState): boolean {
  return state.attempts >= state.maxAttempts;
}

export function getScoreTrend(state: FeedbackLoopState): 'improving' | 'degrading' | 'stable' {
  const h = state.history;
  if (h.length < 2) return 'stable';
  const last = h[h.length - 1].score;
  const prev = h[h.length - 2].score;
  if (last > prev + 0.05) return 'improving';
  if (last < prev - 0.05) return 'degrading';
  return 'stable';
}
