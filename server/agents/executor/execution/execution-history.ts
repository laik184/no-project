import type { ExecutionHistoryEntry } from '../types/execution.types.ts';
import type { StepResult } from '../types/execution.types.ts';

const MAX_ENTRIES_PER_RUN = 500;
const store = new Map<string, ExecutionHistoryEntry[]>();

function getOrCreate(runId: string): ExecutionHistoryEntry[] {
  if (!store.has(runId)) store.set(runId, []);
  return store.get(runId)!;
}

export const executionHistory = {
  record(runId: string, taskId: string, result: StepResult, stepType: string): void {
    const entries = getOrCreate(runId);
    if (entries.length >= MAX_ENTRIES_PER_RUN) entries.shift();
    entries.push({
      taskId,
      runId,
      stepId:     result.stepId,
      stepType,
      success:    result.success,
      durationMs: result.durationMs,
      output:     result.output,
      error:      result.error,
      timestamp:  new Date(),
    });
  },

  getByRun(runId: string): ExecutionHistoryEntry[] {
    return [...(store.get(runId) ?? [])];
  },

  getByTask(runId: string, taskId: string): ExecutionHistoryEntry[] {
    return (store.get(runId) ?? []).filter((e) => e.taskId === taskId);
  },

  countSuccesses(runId: string): number {
    return (store.get(runId) ?? []).filter((e) => e.success).length;
  },

  countFailures(runId: string): number {
    return (store.get(runId) ?? []).filter((e) => !e.success).length;
  },

  clearRun(runId: string): void {
    store.delete(runId);
  },

  exportSummary(runId: string): string {
    const entries = store.get(runId) ?? [];
    const passed  = entries.filter((e) => e.success).length;
    const failed  = entries.filter((e) => !e.success).length;
    return `Run ${runId}: ${entries.length} steps — ${passed} passed, ${failed} failed`;
  },
};
