export interface FailureMemoryEntry {
  runId:     string;
  taskId:    string;
  summary:   string;
  timestamp: number;
}

const store = new Map<string, FailureMemoryEntry[]>();
const MAX   = 200;

export const failureMemory = {
  record(runId: string, taskId: string, summary: string): void {
    if (!store.has(runId)) store.set(runId, []);
    const list = store.get(runId)!;
    if (list.length >= MAX) list.shift();
    list.push({ runId, taskId, summary, timestamp: Date.now() });
  },

  getAll(runId: string): FailureMemoryEntry[] {
    return [...(store.get(runId) ?? [])];
  },

  getForTask(runId: string, taskId: string): FailureMemoryEntry[] {
    return (store.get(runId) ?? []).filter(e => e.taskId === taskId);
  },

  hasFailed(runId: string, taskId: string): boolean {
    return this.getForTask(runId, taskId).length > 0;
  },

  clear(runId: string): void {
    store.delete(runId);
  },
};
