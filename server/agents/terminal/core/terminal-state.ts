/**
 * server/agents/terminal/core/terminal-state.ts
 *
 * Per-run execution state machine.
 * Pure in-process state store — no tool calls, no direct execution.
 */

import type { SessionStatus, TerminalPhase, StepOutcome } from '../types/terminal.types.ts';

export interface ExecutionStateData {
  runId:          string;
  projectId:      string;
  status:         SessionStatus;
  phase:          TerminalPhase;
  totalSteps:     number;
  completedSteps: number;
  failedSteps:    number;
  outcomes:       StepOutcome[];
  startedAt:      number;
  updatedAt:      number;
}

const store = new Map<string, ExecutionStateData>();

export const terminalState = {
  init(runId: string, projectId: string, totalSteps: number): ExecutionStateData {
    const data: ExecutionStateData = {
      runId, projectId,
      status:         'pending',
      phase:          'idle',
      totalSteps,
      completedSteps: 0,
      failedSteps:    0,
      outcomes:       [],
      startedAt:      Date.now(),
      updatedAt:      Date.now(),
    };
    store.set(runId, data);
    return data;
  },

  get(runId: string): ExecutionStateData | undefined { return store.get(runId); },

  setPhase(runId: string, phase: TerminalPhase): void {
    const s = store.get(runId);
    if (s) { s.phase = phase; s.updatedAt = Date.now(); }
  },

  setStatus(runId: string, status: SessionStatus): void {
    const s = store.get(runId);
    if (s) { s.status = status; s.updatedAt = Date.now(); }
  },

  recordOutcome(runId: string, outcome: StepOutcome): void {
    const s = store.get(runId);
    if (!s) return;
    s.outcomes.push(outcome);
    s.completedSteps++;
    if (!outcome.success) s.failedSteps++;
    s.updatedAt = Date.now();
  },

  isComplete(runId: string): boolean {
    const s = store.get(runId);
    return !!s && s.completedSteps >= s.totalSteps;
  },

  isFailed(runId: string): boolean {
    const s = store.get(runId);
    return s?.status === 'failed';
  },

  failureRate(runId: string): number {
    const s = store.get(runId);
    if (!s || s.completedSteps === 0) return 0;
    return s.failedSteps / s.completedSteps;
  },

  clear(runId: string): void { store.delete(runId); },

  allRunIds(): readonly string[] { return Object.freeze([...store.keys()]); },
};
