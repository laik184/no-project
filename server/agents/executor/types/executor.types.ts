import type { ExecutionPlan, PlanTask } from '../../planner/types/planner.types.ts';

export type ExecutorStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ExecutorInput {
  runId:     string;
  projectId: string;
  goal:      string;
  plan:      ExecutionPlan;
  timeoutMs?: number;
  metadata?:  Record<string, unknown>;
}

export interface ExecutorResult {
  ok:             boolean;
  runId:          string;
  tasksTotal:     number;
  tasksCompleted: number;
  tasksFailed:    number;
  durationMs:     number;
  error?:         string;
}

export interface TaskExecutionResult {
  taskId:     string;
  success:    boolean;
  durationMs: number;
  stepsRun:   number;
  error?:     string;
  artifacts:  string[];
}

export interface ExecutorSession {
  sessionId:  string;
  runId:      string;
  projectId:  string;
  status:     ExecutorStatus;
  startedAt:  Date;
  endedAt?:   Date;
  tasksTotal: number;
  tasksDone:  number;
}

export type { ExecutionPlan, PlanTask };
