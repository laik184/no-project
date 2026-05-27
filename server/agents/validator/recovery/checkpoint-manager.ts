export interface Checkpoint {
  id:        string;
  runId:     string;
  step:      string;
  state:     unknown;
  createdAt: number;
}

const checkpoints = new Map<string, Checkpoint[]>();

export const checkpointManager = {
  save(runId: string, step: string, state: unknown): string {
    const id = `cp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    if (!checkpoints.has(runId)) checkpoints.set(runId, []);
    checkpoints.get(runId)!.push({ id, runId, step, state, createdAt: Date.now() });
    return id;
  },
  getLast(runId: string): Checkpoint | undefined {
    const list = checkpoints.get(runId) ?? [];
    return list[list.length - 1];
  },
  getAll(runId: string): Checkpoint[] {
    return [...(checkpoints.get(runId) ?? [])];
  },
  clear(runId: string): void {
    checkpoints.delete(runId);
  },
};
