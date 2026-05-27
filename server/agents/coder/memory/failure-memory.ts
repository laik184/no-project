interface FailureRecord {
  taskId: string;
  summary: string;
  recordedAt: Date;
}

const store = new Map<string, FailureRecord[]>();

export const failureMemory = {
  record(runId: string, taskId: string, summary: string): void {
    const list = store.get(runId) ?? [];
    list.push({ taskId, summary, recordedAt: new Date() });
    store.set(runId, list);
  },
  get(runId: string): FailureRecord[] {
    return store.get(runId) ?? [];
  },
  clear(runId: string): void {
    store.delete(runId);
  },
};
