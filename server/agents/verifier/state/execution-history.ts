/**
 * state/execution-history.ts
 * Tracks execution history for step runs and dispatches per run.
 */

import type { StepResult } from '../types/execution.types.ts';

export interface DispatchRecord {
  toolName:   string;
  runId:      string;
  attempt:    number;
  ok:         boolean;
  durationMs: number;
  error?:     string;
  timestamp:  Date;
}

const stepHistory     = new Map<string, StepResult[]>();
const dispatchHistory = new Map<string, DispatchRecord[]>();

export const executionHistory = {
  recordStep(runId: string, result: StepResult): void {
    if (!stepHistory.has(runId)) stepHistory.set(runId, []);
    stepHistory.get(runId)!.push(result);
  },

  recordDispatch(runId: string, record: Omit<DispatchRecord, 'runId' | 'timestamp'>): void {
    if (!dispatchHistory.has(runId)) dispatchHistory.set(runId, []);
    dispatchHistory.get(runId)!.push({ ...record, runId, timestamp: new Date() });
  },

  getSteps(runId: string): StepResult[] {
    return [...(stepHistory.get(runId) ?? [])];
  },

  getDispatches(runId: string): DispatchRecord[] {
    return [...(dispatchHistory.get(runId) ?? [])];
  },

  getFailedSteps(runId: string): StepResult[] {
    return (stepHistory.get(runId) ?? []).filter((s) => !s.passed);
  },

  countAttempts(runId: string, toolName: string): number {
    return (dispatchHistory.get(runId) ?? []).filter((d) => d.toolName === toolName).length;
  },

  clear(runId: string): void {
    stepHistory.delete(runId);
    dispatchHistory.delete(runId);
  },
};
