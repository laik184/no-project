export interface ExecutionMemoryEntry {
  runId:      string;
  timestamp:  number;
  data:       unknown;
}

const store = new Map<string, ExecutionMemoryEntry[]>();
const MAX   = 500;

export const executionMemory = {
  record(runId: string, data: unknown): void {
    if (!store.has(runId)) store.set(runId, []);
    const list = store.get(runId)!;
    if (list.length >= MAX) list.shift();
    list.push({ runId, timestamp: Date.now(), data });
  },

  getAll(runId: string): ExecutionMemoryEntry[] {
    return [...(store.get(runId) ?? [])];
  },

  getLast(runId: string): ExecutionMemoryEntry | undefined {
    const list = store.get(runId) ?? [];
    return list[list.length - 1];
  },

  clear(runId: string): void {
    store.delete(runId);
  },

  count(runId: string): number {
    return (store.get(runId) ?? []).length;
  },
};
