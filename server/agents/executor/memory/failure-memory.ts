/**
 * failure-memory.ts
 * Tracks failure patterns per run so the LLM tool loop avoids repeating mistakes.
 */

export interface FailureEntry {
  taskId:    string;
  error:     string;
  timestamp: Date;
}

class FailureMemory {
  private store = new Map<string, FailureEntry[]>();

  record(runId: string, taskId: string, error: string): void {
    const list = this.store.get(runId) ?? [];
    list.push({ taskId, error: error.slice(0, 500), timestamp: new Date() });
    // Keep last 20 per run
    if (list.length > 20) list.shift();
    this.store.set(runId, list);
  }

  getAll(runId: string): FailureEntry[] {
    return this.store.get(runId) ?? [];
  }

  getRecent(runId: string, n: number): FailureEntry[] {
    return (this.store.get(runId) ?? []).slice(-n);
  }

  getForTask(runId: string, taskId: string): FailureEntry[] {
    return (this.store.get(runId) ?? []).filter((e) => e.taskId === taskId);
  }

  hasFailure(runId: string, errorPattern: string): boolean {
    return (this.store.get(runId) ?? []).some((e) =>
      e.error.toLowerCase().includes(errorPattern.toLowerCase()),
    );
  }

  clear(runId: string): void {
    this.store.delete(runId);
  }

  clearAll(): void {
    this.store.clear();
  }
}

export const failureMemory = new FailureMemory();
