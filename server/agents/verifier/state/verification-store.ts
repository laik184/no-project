/**
 * state/verification-store.ts
 * In-memory store for active and recent verification runs.
 */

import type { VerificationInput, VerificationResult, VerificationStatus, PhaseResult } from '../types/verifier.types.ts';

export interface VerificationRecord {
  input:      VerificationInput;
  status:     VerificationStatus;
  phases:     PhaseResult[];
  startedAt:  Date;
  updatedAt:  Date;
  completedAt?: Date;
  result?:    VerificationResult;
  errorCount: number;
}

const MAX_COMPLETED = 50;
const store       = new Map<string, VerificationRecord>();
const completedIds: string[] = [];

export const verificationStore = {
  create(input: VerificationInput): VerificationRecord {
    const record: VerificationRecord = {
      input,
      status:     'pending',
      phases:     [],
      startedAt:  new Date(),
      updatedAt:  new Date(),
      errorCount: 0,
    };
    store.set(input.runId, record);
    return record;
  },

  get(runId: string): VerificationRecord | undefined {
    return store.get(runId);
  },

  require(runId: string): VerificationRecord {
    const r = store.get(runId);
    if (!r) throw new Error(`[verification-store] No record for runId: ${runId}`);
    return r;
  },

  setStatus(runId: string, status: VerificationStatus): void {
    const r = store.get(runId);
    if (r) { r.status = status; r.updatedAt = new Date(); }
  },

  addPhaseResult(runId: string, phase: PhaseResult): void {
    const r = store.get(runId);
    if (r) {
      r.phases.push(phase);
      r.errorCount += phase.errors.length;
      r.updatedAt = new Date();
    }
  },

  complete(runId: string, result: VerificationResult): void {
    const r = store.get(runId);
    if (r) {
      r.status      = result.overallStatus;
      r.result      = result;
      r.completedAt = new Date();
      r.updatedAt   = new Date();
      completedIds.push(runId);
      if (completedIds.length > MAX_COMPLETED) {
        const evicted = completedIds.shift()!;
        store.delete(evicted);
      }
    }
  },

  listActive(): VerificationRecord[] {
    return Array.from(store.values()).filter(
      (r) => r.status === 'pending' || r.status === 'running',
    );
  },

  clear(runId: string): void {
    store.delete(runId);
  },
};
