export interface Checkpoint {
  runId: string;
  phase: string;
  snapshot: Record<string, unknown>;
  createdAt: Date;
}

const checkpoints = new Map<string, Checkpoint[]>();

export function saveCheckpoint(runId: string, phase: string, snapshot: Record<string, unknown>): void {
  if (!checkpoints.has(runId)) checkpoints.set(runId, []);
  checkpoints.get(runId)!.push({ runId, phase, snapshot, createdAt: new Date() });
}

export function getCheckpoints(runId: string): Checkpoint[] {
  return checkpoints.get(runId) ?? [];
}

export function getLatestCheckpoint(runId: string): Checkpoint | undefined {
  const list = checkpoints.get(runId);
  return list?.at(-1);
}

export function clearCheckpoints(runId: string): void {
  checkpoints.delete(runId);
}

export function hasCheckpoint(runId: string, phase: string): boolean {
  return (checkpoints.get(runId) ?? []).some((c) => c.phase === phase);
}

export function replayFromCheckpoint(runId: string, phase: string): Checkpoint | undefined {
  return (checkpoints.get(runId) ?? []).find((c) => c.phase === phase);
}
