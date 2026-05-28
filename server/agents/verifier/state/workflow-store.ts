/**
 * state/workflow-store.ts
 * In-memory store for workflow states per run.
 */

import type { WorkflowState, WorkflowKind } from '../types/workflow.types.ts';
import type { VerificationPhase } from '../types/verifier.types.ts';

const store = new Map<string, Map<WorkflowKind, WorkflowState>>();

function runMap(runId: string): Map<WorkflowKind, WorkflowState> {
  if (!store.has(runId)) store.set(runId, new Map());
  return store.get(runId)!;
}

export const workflowStore = {
  init(runId: string, kind: WorkflowKind, phase: VerificationPhase): WorkflowState {
    const state: WorkflowState = {
      runId,
      kind,
      status:         'running',
      phase,
      completedSteps: [],
      failedSteps:    [],
      startedAt:      new Date(),
      updatedAt:      new Date(),
    };
    runMap(runId).set(kind, state);
    return state;
  },

  get(runId: string, kind: WorkflowKind): WorkflowState | undefined {
    return runMap(runId).get(kind);
  },

  markStepComplete(runId: string, kind: WorkflowKind, stepId: string): void {
    const s = runMap(runId).get(kind);
    if (s) { s.completedSteps.push(stepId); s.updatedAt = new Date(); }
  },

  markStepFailed(runId: string, kind: WorkflowKind, stepId: string): void {
    const s = runMap(runId).get(kind);
    if (s) { s.failedSteps.push(stepId); s.updatedAt = new Date(); }
  },

  complete(runId: string, kind: WorkflowKind): void {
    const s = runMap(runId).get(kind);
    if (s) { s.status = 'completed'; s.updatedAt = new Date(); }
  },

  fail(runId: string, kind: WorkflowKind): void {
    const s = runMap(runId).get(kind);
    if (s) { s.status = 'failed'; s.updatedAt = new Date(); }
  },

  listForRun(runId: string): WorkflowState[] {
    return Array.from(runMap(runId).values());
  },

  clearRun(runId: string): void {
    store.delete(runId);
  },
};
