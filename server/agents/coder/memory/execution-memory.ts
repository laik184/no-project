interface ExecutionRecord {
  taskId: string;
  title: string;
  status: string;
  artifacts: string[];
  summary: string;
  durationMs: number;
}

const store = new Map<string, ExecutionRecord[]>();

export const executionMemory = {
  record(runId: string, data: ExecutionRecord): void {
    const list = store.get(runId) ?? [];
    list.push(data);
    store.set(runId, list);
  },
  get(runId: string): ExecutionRecord[] {
    return store.get(runId) ?? [];
  },
  clear(runId: string): void {
    store.delete(runId);
  },
};
