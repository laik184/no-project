/**
 * execution-memory.ts
 * In-memory log of task execution outcomes per run.
 * Single responsibility: record and query execution history.
 */

export interface ExecutionRecord {
  taskId:     string;
  title:      string;
  status:     'completed' | 'failed' | 'skipped';
  artifacts:  string[];
  summary:    string;
  durationMs: number;
  recordedAt: Date;
}

const store = new Map<string, ExecutionRecord[]>();

export const executionMemory = {
  record(runId: string, entry: Omit<ExecutionRecord, 'recordedAt'>): void {
    if (!store.has(runId)) store.set(runId, []);
    store.get(runId)!.push({ ...entry, recordedAt: new Date() });
  },

  getAll(runId: string): ExecutionRecord[] {
    return store.get(runId) ?? [];
  },

  countByStatus(runId: string, status: ExecutionRecord['status']): number {
    return (store.get(runId) ?? []).filter((r) => r.status === status).length;
  },

  clear(runId: string): void {
    store.delete(runId);
  },
};
