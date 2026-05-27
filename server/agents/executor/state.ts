import type { ExecutorStatus, ExecutionStateData } from './types.ts';

const stateStore = new Map<string, ExecutionStateData>();

export const executionState = {
  init(runId: string, projectId: string, tasksTotal: number): ExecutionStateData {
    const state: ExecutionStateData = {
      runId, projectId,
      status:      'running',
      tasksTotal,
      tasksDone:   0,
      tasksFailed: 0,
      startedAt:   new Date(),
      updatedAt:   new Date(),
    };
    stateStore.set(runId, state);
    return state;
  },

  get(runId: string): ExecutionStateData | undefined {
    return stateStore.get(runId);
  },

  setCurrentTask(runId: string, taskId: string): void {
    const s = stateStore.get(runId);
    if (!s) return;
    s.currentTaskId = taskId;
    s.updatedAt     = new Date();
  },

  recordTaskDone(runId: string, success: boolean): void {
    const s = stateStore.get(runId);
    if (!s) return;
    if (success) s.tasksDone++;
    else         s.tasksFailed++;
    s.currentTaskId = undefined;
    s.updatedAt     = new Date();
  },

  setStatus(runId: string, status: ExecutorStatus): void {
    const s = stateStore.get(runId);
    if (!s) return;
    s.status    = status;
    s.updatedAt = new Date();
  },

  isDone(runId: string): boolean {
    const s = stateStore.get(runId);
    if (!s) return true;
    return s.tasksDone + s.tasksFailed >= s.tasksTotal;
  },

  clear(runId: string): void {
    stateStore.delete(runId);
  },
};
