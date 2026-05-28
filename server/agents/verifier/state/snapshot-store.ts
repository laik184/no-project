/**
 * state/snapshot-store.ts
 * Immutable checkpoint snapshots for recovery/rollback.
 */

import type { VerificationStatus, PhaseResult } from '../types/verifier.types.ts';

export interface VerificationSnapshot {
  runId:      string;
  projectId:  string;
  status:     VerificationStatus;
  phases:     PhaseResult[];
  createdAt:  Date;
  errorCount: number;
  label?:     string;
}

const MAX_SNAPSHOTS_PER_RUN = 10;
const snapshotStore = new Map<string, VerificationSnapshot[]>();

function getSnapshots(runId: string): VerificationSnapshot[] {
  if (!snapshotStore.has(runId)) snapshotStore.set(runId, []);
  return snapshotStore.get(runId)!;
}

export const snapshotStore_ = {
  save(snapshot: VerificationSnapshot): void {
    const list = getSnapshots(snapshot.runId);
    list.push(snapshot);
    if (list.length > MAX_SNAPSHOTS_PER_RUN) list.shift();
  },

  latest(runId: string): VerificationSnapshot | undefined {
    const list = getSnapshots(runId);
    return list.at(-1);
  },

  all(runId: string): VerificationSnapshot[] {
    return [...getSnapshots(runId)];
  },

  byLabel(runId: string, label: string): VerificationSnapshot | undefined {
    return getSnapshots(runId).find((s) => s.label === label);
  },

  clear(runId: string): void {
    snapshotStore.delete(runId);
  },
};

export function makeSnapshot(
  runId:     string,
  projectId: string,
  status:    VerificationStatus,
  phases:    PhaseResult[],
  label?:    string,
): VerificationSnapshot {
  return {
    runId,
    projectId,
    status,
    phases:     [...phases],
    createdAt:  new Date(),
    errorCount: phases.reduce((n, p) => n + p.errors.length, 0),
    label,
  };
}
