export interface ExecutionMemoryEntry {
  taskId:    string;
  title:     string;
  status:    'completed' | 'failed';
  artifacts: string[];
  summary?:  string;
  durationMs: number;
}

const memory = new Map<string, ExecutionMemoryEntry[]>();

function getOrCreate(runId: string): ExecutionMemoryEntry[] {
  if (!memory.has(runId)) memory.set(runId, []);
  return memory.get(runId)!;
}

export const executionMemory = {
  record(runId: string, entry: ExecutionMemoryEntry): void {
    getOrCreate(runId).push(entry);
  },

  getForRun(runId: string): ExecutionMemoryEntry[] {
    return memory.get(runId) ?? [];
  },

  getArtifacts(runId: string): string[] {
    return (memory.get(runId) ?? []).flatMap((e) => e.artifacts);
  },

  clear(runId: string): void {
    memory.delete(runId);
  },
};
