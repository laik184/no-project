/**
 * server/agents/verifier/core/verifier-state.ts
 * Per-run state machine — tracks outcomes, failures, and progress.
 */

import type { VerificationPhase, VerificationStatus, VerificationStepResult } from '../types/verifier.types.ts';

export interface VerifierStateData {
  runId:          string;
  status:         VerificationStatus;
  totalSteps:     number;
  completedSteps: number;
  failedSteps:    number;
  results:        VerificationStepResult[];
  startedAt:      number;
  updatedAt:      number;
}

const store = new Map<string, VerifierStateData>();

export const verifierState = {
  init(runId: string, totalSteps: number): VerifierStateData {
    const data: VerifierStateData = {
      runId,
      status:         'pending',
      totalSteps,
      completedSteps: 0,
      failedSteps:    0,
      results:        [],
      startedAt:      Date.now(),
      updatedAt:      Date.now(),
    };
    store.set(runId, data);
    return data;
  },

  get(runId: string): VerifierStateData | undefined {
    return store.get(runId);
  },

  setStatus(runId: string, status: VerificationStatus): void {
    const s = store.get(runId);
    if (s) { s.status = status; s.updatedAt = Date.now(); }
  },

  recordResult(runId: string, result: VerificationStepResult): void {
    const s = store.get(runId);
    if (!s) return;
    s.results.push(result);
    s.completedSteps++;
    if (!result.success) s.failedSteps++;
    s.updatedAt = Date.now();
  },

  failureRate(runId: string): number {
    const s = store.get(runId);
    if (!s || s.completedSteps === 0) return 0;
    return s.failedSteps / s.completedSteps;
  },

  errors(runId: string): string[] {
    const s = store.get(runId);
    return s?.results.filter((r) => !r.success && r.error).map((r) => r.error!) ?? [];
  },

  phases(runId: string): VerificationPhase[] {
    const s = store.get(runId);
    const seen = new Set<VerificationPhase>();
    for (const r of s?.results ?? []) seen.add(r.phase);
    return [...seen];
  },

  clear(runId: string): void { store.delete(runId); },

  allRunIds(): readonly string[] { return Object.freeze([...store.keys()]); },
};
