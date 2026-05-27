import type { ExecutionPlan, PlanTask } from '../planner/types/planner.types.ts';

// ── Step / Execution types ─────────────────────────────────────────────────

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export type StepType =
  | 'generate_frontend'
  | 'generate_backend'
  | 'generate_api'
  | 'generate_database'
  | 'generate_auth'
  | 'generate_component'
  | 'write_file'
  | 'read_file'
  | 'edit_file'
  | 'patch_file'
  | 'delete_file'
  | 'list_directory'
  | 'search_files'
  | 'npm_install'
  | 'npm_run'
  | 'run_command'
  | 'run_tests'
  | 'validate_output'
  | 'checkpoint';

export interface StepInput {
  filePath?:    string;
  fileContent?: string;
  oldString?:   string;
  newString?:   string;
  command?:     string;
  args?:        string[];
  query?:       string;
  recursive?:   boolean;
  description?: string;
  category?:    string;
  template?:    string;
  name?:        string;
  options?:     Record<string, unknown>;
}

export interface ExecutionStep {
  id:        string;
  taskId:    string;
  type:      StepType;
  label:     string;
  input:     StepInput;
  timeoutMs: number;
}

export interface StepResult {
  stepId:     string;
  success:    boolean;
  durationMs: number;
  output?:    string;
  filePath?:  string;
  error?:     string;
}

export interface CheckpointData {
  checkpointId:  string;
  taskId:        string;
  runId:         string;
  filesSnapshot: Array<{ path: string; content: string }>;
  createdAt:     Date;
  diskPath?:     string;
}

export interface ExecutionHistoryEntry {
  taskId:     string;
  runId:      string;
  stepId:     string;
  stepType:   StepType;
  success:    boolean;
  durationMs: number;
  output?:    string;
  error?:     string;
  timestamp:  Date;
}

// ── Executor types ─────────────────────────────────────────────────────────

export type ExecutorStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ExecutorInput {
  runId:      string;
  projectId:  string;
  goal:       string;
  plan:       ExecutionPlan;
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

export interface ExecutionStateData {
  runId:          string;
  projectId:      string;
  status:         ExecutorStatus;
  currentTaskId?: string;
  tasksTotal:     number;
  tasksDone:      number;
  tasksFailed:    number;
  startedAt:      Date;
  updatedAt:      Date;
}

export type { ExecutionPlan, PlanTask };
