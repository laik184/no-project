import type { PlanningStatus, ExecutionPlan } from '../types/planner.types.ts';

export interface PlanningState {
  status:     PlanningStatus;
  startedAt:  Date;
  endedAt:    Date | null;
  plan:       ExecutionPlan | null;
  error:      string | null;
  durationMs: number | null;
}

export function createInitialState(): PlanningState {
  return {
    status:     'pending',
    startedAt:  new Date(),
    endedAt:    null,
    plan:       null,
    error:      null,
    durationMs: null,
  };
}

export function transitionToRunning(state: PlanningState): PlanningState {
  return { ...state, status: 'running' };
}

export function transitionToCompleted(state: PlanningState, plan: ExecutionPlan): PlanningState {
  const endedAt    = new Date();
  const durationMs = endedAt.getTime() - state.startedAt.getTime();
  return { ...state, status: 'completed', endedAt, plan, durationMs };
}

export function transitionToFailed(state: PlanningState, error: string): PlanningState {
  const endedAt    = new Date();
  const durationMs = endedAt.getTime() - state.startedAt.getTime();
  return { ...state, status: 'failed', endedAt, error, durationMs };
}

export function isTerminal(state: PlanningState): boolean {
  return state.status === 'completed' || state.status === 'failed';
}
