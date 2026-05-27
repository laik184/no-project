import type { OrchestrationPhase } from '../../../orchestration/events/event-types.ts';

interface TaskRecord {
  taskId: string;
  runId: string;
  phase: OrchestrationPhase;
  startedAt: number;
  lastActivityAt: number;
  stuckThresholdMs: number;
}

const taskRecords = new Map<string, Map<string, TaskRecord>>();

const DEFAULT_STUCK_THRESHOLD_MS = 60_000; // 1 minute without activity = stuck

function runRecords(runId: string): Map<string, TaskRecord> {
  if (!taskRecords.has(runId)) taskRecords.set(runId, new Map());
  return taskRecords.get(runId)!;
}

export const stuckTaskDetector = {
  register(
    runId: string,
    taskId: string,
    phase: OrchestrationPhase,
    stuckThresholdMs = DEFAULT_STUCK_THRESHOLD_MS,
  ): void {
    const now = Date.now();
    runRecords(runId).set(taskId, {
      taskId, runId, phase,
      startedAt:       now,
      lastActivityAt:  now,
      stuckThresholdMs,
    });
  },

  heartbeat(runId: string, taskId: string): void {
    const record = runRecords(runId).get(taskId);
    if (record) record.lastActivityAt = Date.now();
  },

  complete(runId: string, taskId: string): void {
    runRecords(runId).delete(taskId);
  },

  isStuck(runId: string, taskId: string): boolean {
    const record = runRecords(runId).get(taskId);
    if (!record) return false;
    return Date.now() - record.lastActivityAt > record.stuckThresholdMs;
  },

  getStuckTasks(runId: string): string[] {
    const now = Date.now();
    return Array.from(runRecords(runId).values())
      .filter((r) => now - r.lastActivityAt > r.stuckThresholdMs)
      .map((r) => r.taskId);
  },

  stuckDurationMs(runId: string, taskId: string): number {
    const record = runRecords(runId).get(taskId);
    if (!record) return 0;
    return Date.now() - record.lastActivityAt;
  },

  allTasks(runId: string): TaskRecord[] {
    return Array.from(runRecords(runId).values());
  },

  clearRun(runId: string): void {
    taskRecords.delete(runId);
  },
};
