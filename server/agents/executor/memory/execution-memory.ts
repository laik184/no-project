/**
 * execution-memory.ts
 * Per-run execution memory: tracks what has been built, what is pending.
 */

export interface ExecutionMemoryEntry {
  taskId:    string;
  title:     string;
  status:    'completed' | 'failed' | 'skipped';
  artifacts: string[];
  summary:   string;
  durationMs:number;
}

class ExecutionMemory {
  private store = new Map<string, ExecutionMemoryEntry[]>();

  record(runId: string, entry: ExecutionMemoryEntry): void {
    const list = this.store.get(runId) ?? [];
    // Prevent duplicates
    const idx = list.findIndex((e) => e.taskId === entry.taskId);
    if (idx >= 0) { list[idx] = entry; } else { list.push(entry); }
    this.store.set(runId, list);
  }

  get(runId: string): ExecutionMemoryEntry[] {
    return this.store.get(runId) ?? [];
  }

  getCompleted(runId: string): ExecutionMemoryEntry[] {
    return (this.store.get(runId) ?? []).filter((e) => e.status === 'completed');
  }

  getFailed(runId: string): ExecutionMemoryEntry[] {
    return (this.store.get(runId) ?? []).filter((e) => e.status === 'failed');
  }

  allArtifacts(runId: string): string[] {
    return (this.store.get(runId) ?? []).flatMap((e) => e.artifacts);
  }

  toSummary(runId: string): string {
    const entries = this.store.get(runId) ?? [];
    if (entries.length === 0) return 'No tasks completed yet.';
    return entries
      .map((e) => `[${e.status.toUpperCase()}] ${e.title}: ${e.summary}`)
      .join('\n');
  }

  clear(runId: string): void {
    this.store.delete(runId);
  }
}

export const executionMemory = new ExecutionMemory();
