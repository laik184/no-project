/**
 * server/agents/planner/core/planner-state.ts
 *
 * Per-run planning state machine.
 * Pure in-process state store — no tool calls, no direct execution.
 */

import type {
  PlanningStatus,
  PlanningPhase,
  PlanningTaskOutcome,
  ExecutionPlan,
} from '../types/planner.types.ts';

export interface PlanningStateData {
  runId:          string;
  projectId:      string;
  goal:           string;
  status:         PlanningStatus;
  phase:          PlanningPhase;
  outcomes:       PlanningTaskOutcome[];
  plan?:          ExecutionPlan;
  startedAt:      number;
  updatedAt:      number;
  refinements:    number;
}

const store = new Map<string, PlanningStateData>();

export const plannerState = {
  init(runId: string, projectId: string, goal: string): PlanningStateData {
    const data: PlanningStateData = {
      runId, projectId, goal,
      status:      'pending',
      phase:       'idle',
      outcomes:    [],
      refinements: 0,
      startedAt:   Date.now(),
      updatedAt:   Date.now(),
    };
    store.set(runId, data);
    return data;
  },

  get(runId: string): PlanningStateData | undefined {
    return store.get(runId);
  },

  setPhase(runId: string, phase: PlanningPhase): void {
    const s = store.get(runId);
    if (s) { s.phase = phase; s.updatedAt = Date.now(); }
  },

  setStatus(runId: string, status: PlanningStatus): void {
    const s = store.get(runId);
    if (s) { s.status = status; s.updatedAt = Date.now(); }
  },

  setPlan(runId: string, plan: ExecutionPlan): void {
    const s = store.get(runId);
    if (s) { s.plan = plan; s.updatedAt = Date.now(); }
  },

  recordOutcome(runId: string, outcome: PlanningTaskOutcome): void {
    const s = store.get(runId);
    if (!s) return;
    s.outcomes.push(outcome);
    s.updatedAt = Date.now();
  },

  incrementRefinements(runId: string): void {
    const s = store.get(runId);
    if (s) { s.refinements++; s.updatedAt = Date.now(); }
  },

  hasPlan(runId: string): boolean {
    return !!(store.get(runId)?.plan);
  },

  isFailed(runId: string): boolean {
    return store.get(runId)?.status === 'failed';
  },

  clear(runId: string): void {
    store.delete(runId);
  },

  allRunIds(): readonly string[] {
    return Object.freeze([...store.keys()]);
  },
};
