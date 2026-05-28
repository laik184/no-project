/**
 * server/agents/supervisor/core/supervisor-state.ts
 *
 * Per-run supervision state machine.
 * Pure in-process state store — no tool calls, no direct execution.
 */

import type {
  SupervisionStatus,
  SupervisionPhase,
  TaskOutcome,
} from '../types/supervisor.types.ts';

export interface SupervisionStateData {
  runId:          string;
  projectId:      string;
  goal:           string;
  status:         SupervisionStatus;
  phase:          SupervisionPhase;
  totalTasks:     number;
  completedTasks: number;
  failedTasks:    number;
  outcomes:       TaskOutcome[];
  startedAt:      number;
  updatedAt:      number;
}

const store = new Map<string, SupervisionStateData>();

export const supervisorState = {
  init(
    runId:      string,
    projectId:  string,
    goal:       string,
    totalTasks: number,
  ): SupervisionStateData {
    const data: SupervisionStateData = {
      runId, projectId, goal,
      status:         'pending',
      phase:          'idle',
      totalTasks,
      completedTasks: 0,
      failedTasks:    0,
      outcomes:       [],
      startedAt:      Date.now(),
      updatedAt:      Date.now(),
    };
    store.set(runId, data);
    return data;
  },

  get(runId: string): SupervisionStateData | undefined {
    return store.get(runId);
  },

  setPhase(runId: string, phase: SupervisionPhase): void {
    const s = store.get(runId);
    if (s) { s.phase = phase; s.updatedAt = Date.now(); }
  },

  setStatus(runId: string, status: SupervisionStatus): void {
    const s = store.get(runId);
    if (s) { s.status = status; s.updatedAt = Date.now(); }
  },

  recordOutcome(runId: string, outcome: TaskOutcome): void {
    const s = store.get(runId);
    if (!s) return;
    s.outcomes.push(outcome);
    s.completedTasks++;
    if (!outcome.success) s.failedTasks++;
    s.updatedAt = Date.now();
  },

  isComplete(runId: string): boolean {
    const s = store.get(runId);
    return !!s && s.completedTasks >= s.totalTasks;
  },

  isFailed(runId: string): boolean {
    const s = store.get(runId);
    return s?.status === 'failed';
  },

  failureRate(runId: string): number {
    const s = store.get(runId);
    if (!s || s.completedTasks === 0) return 0;
    return s.failedTasks / s.completedTasks;
  },

  clear(runId: string): void {
    store.delete(runId);
  },

  allRunIds(): readonly string[] {
    return Object.freeze([...store.keys()]);
  },
};
