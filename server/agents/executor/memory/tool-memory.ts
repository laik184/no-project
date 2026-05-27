/**
 * tool-memory.ts
 * Tracks which tools were called during a run and their outcomes.
 * Used for loop-detection and execution summaries.
 */

export interface ToolCallRecord {
  iteration:  number;
  toolName:   string;
  argsSummary:string;
  success:    boolean;
  durationMs: number;
  timestamp:  Date;
}

class ToolMemory {
  private store = new Map<string, ToolCallRecord[]>();

  record(
    runId:      string,
    iteration:  number,
    toolName:   string,
    args:       Record<string, unknown>,
    success:    boolean,
    durationMs: number,
  ): void {
    const argsSummary = summariseArgs(args);
    const list        = this.store.get(runId) ?? [];
    list.push({ iteration, toolName, argsSummary, success, durationMs, timestamp: new Date() });
    this.store.set(runId, list);
  }

  getAll(runId: string): ToolCallRecord[] {
    return this.store.get(runId) ?? [];
  }

  getSuccessful(runId: string): ToolCallRecord[] {
    return (this.store.get(runId) ?? []).filter((r) => r.success);
  }

  getFailed(runId: string): ToolCallRecord[] {
    return (this.store.get(runId) ?? []).filter((r) => !r.success);
  }

  /** Check if the same tool+args combo was called recently. */
  isDuplicate(runId: string, toolName: string, args: Record<string, unknown>): boolean {
    const argSum = summariseArgs(args);
    const recent = (this.store.get(runId) ?? []).slice(-6);
    return recent.filter((r) => r.toolName === toolName && r.argsSummary === argSum).length >= 2;
  }

  clear(runId: string): void {
    this.store.delete(runId);
  }
}

function summariseArgs(args: Record<string, unknown>): string {
  try {
    return JSON.stringify(args).slice(0, 200);
  } catch {
    return String(args);
  }
}

export const toolMemory = new ToolMemory();
