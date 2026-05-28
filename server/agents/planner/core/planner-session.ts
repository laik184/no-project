/**
 * server/agents/planner/core/planner-session.ts
 *
 * Manages the lifecycle of a planning session: open, transition, close.
 * Thin wrapper over planner-state that owns the session metadata.
 */

import type { PlanningPhase, PlanningSessionMeta, PlanningStatus } from '../types/planner.types.ts';
import { plannerState } from './planner-state.ts';

const sessions = new Map<string, PlanningSessionMeta>();

export const plannerSession = {
  open(params: {
    runId:       string;
    projectId:   string;
    sandboxRoot: string;
    goal:        string;
  }): void {
    const { runId, projectId, sandboxRoot, goal } = params;
    plannerState.init(runId, projectId, goal);
    sessions.set(runId, {
      runId, projectId, sandboxRoot, goal,
      startedAt: new Date(),
      status:    'running',
      phase:     'idle',
    });
  },

  transition(runId: string, phase: PlanningPhase): void {
    const s = sessions.get(runId);
    if (s) {
      s.phase = phase;
      plannerState.setPhase(runId, phase);
    }
  },

  setStatus(runId: string, status: PlanningStatus): void {
    const s = sessions.get(runId);
    if (s) {
      s.status = status;
      plannerState.setStatus(runId, status);
    }
  },

  close(runId: string, success: boolean, durationMs: number): void {
    const s = sessions.get(runId);
    if (s) {
      s.status = success ? 'completed' : 'failed';
      s.phase  = success ? 'completing' : 'failed';
      plannerState.setStatus(runId, s.status);
    }
    void durationMs;
  },

  get(runId: string): PlanningSessionMeta | undefined {
    return sessions.get(runId);
  },

  isOpen(runId: string): boolean {
    const s = sessions.get(runId);
    return s?.status === 'running';
  },

  clear(runId: string): void {
    sessions.delete(runId);
    plannerState.clear(runId);
  },

  allRunIds(): readonly string[] {
    return Object.freeze([...sessions.keys()]);
  },
};
