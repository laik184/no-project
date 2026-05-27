/**
 * failure-memory.ts
 * In-memory log of task failures per run.
 * Single responsibility: record and surface failure patterns.
 */

export interface FailureRecord {
  taskId:     string;
  message:    string;
  recordedAt: Date;
}

const store = new Map<string, FailureRecord[]>();

export const failureMemory = {
  record(runId: string, taskId: string, message: string): void {
    if (!store.has(runId)) store.set(runId, []);
    store.get(runId)!.push({ taskId, message, recordedAt: new Date() });
  },

  getAll(runId: string): FailureRecord[] {
    return store.get(runId) ?? [];
  },

  count(runId: string): number {
    return (store.get(runId) ?? []).length;
  },

  hasFailure(runId: string, taskId: string): boolean {
    return (store.get(runId) ?? []).some((r) => r.taskId === taskId);
  },

  clear(runId: string): void {
    store.delete(runId);
  },
};
