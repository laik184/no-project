export interface FailureMemoryEntry {
  taskId:    string;
  summary:   string;
  recordedAt: Date;
}

const failures = new Map<string, FailureMemoryEntry[]>();

function getOrCreate(runId: string): FailureMemoryEntry[] {
  if (!failures.has(runId)) failures.set(runId, []);
  return failures.get(runId)!;
}

export const failureMemory = {
  record(runId: string, taskId: string, summary: string): void {
    getOrCreate(runId).push({ taskId, summary, recordedAt: new Date() });
  },

  getForRun(runId: string): FailureMemoryEntry[] {
    return failures.get(runId) ?? [];
  },

  hasFailures(runId: string): boolean {
    return (failures.get(runId) ?? []).length > 0;
  },

  clear(runId: string): void {
    failures.delete(runId);
  },
};
