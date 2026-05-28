/**
 * core/verifier-state.ts
 * Tracks real-time state of an active verification run.
 */

import type { VerificationStatus, VerificationPhase, PhaseResult } from '../types/verifier.types.ts';

export interface VerifierRunState {
  runId:          string;
  projectId:      string;
  status:         VerificationStatus;
  currentPhase:   VerificationPhase | null;
  completedPhases: PhaseResult[];
  startedAt:      Date;
  updatedAt:      Date;
  aborted:        boolean;
  abortReason?:   string;
}

const stateMap = new Map<string, VerifierRunState>();

export const verifierState = {
  init(runId: string, projectId: string): VerifierRunState {
    const state: VerifierRunState = {
      runId,
      projectId,
      status:          'running',
      currentPhase:    null,
      completedPhases: [],
      startedAt:       new Date(),
      updatedAt:       new Date(),
      aborted:         false,
    };
    stateMap.set(runId, state);
    return state;
  },

  get(runId: string): VerifierRunState | undefined {
    return stateMap.get(runId);
  },

  require(runId: string): VerifierRunState {
    const s = stateMap.get(runId);
    if (!s) throw new Error(`[verifier-state] No state for run: ${runId}`);
    return s;
  },

  setPhase(runId: string, phase: VerificationPhase | null): void {
    const s = stateMap.get(runId);
    if (s) { s.currentPhase = phase; s.updatedAt = new Date(); }
  },

  addPhase(runId: string, result: PhaseResult): void {
    const s = stateMap.get(runId);
    if (s) {
      s.completedPhases.push(result);
      s.currentPhase = null;
      s.updatedAt    = new Date();
    }
  },

  setStatus(runId: string, status: VerificationStatus): void {
    const s = stateMap.get(runId);
    if (s) { s.status = status; s.updatedAt = new Date(); }
  },

  abort(runId: string, reason: string): void {
    const s = stateMap.get(runId);
    if (s) { s.aborted = true; s.abortReason = reason; s.status = 'failed'; s.updatedAt = new Date(); }
  },

  isAborted(runId: string): boolean {
    return stateMap.get(runId)?.aborted ?? false;
  },

  clear(runId: string): void {
    stateMap.delete(runId);
  },

  listActive(): string[] {
    return Array.from(stateMap.entries())
      .filter(([, s]) => s.status === 'running')
      .map(([id]) => id);
  },
};
