/**
 * server/agents/executor/types/executor.types.ts
 *
 * All shared type contracts for the executor agent layer.
 * No runtime logic — types and interfaces only.
 */

// ── Task kinds ────────────────────────────────────────────────────────────────

export type TaskKind =
  | 'terminal'
  | 'filesystem'
  | 'coding'
  | 'verify'
  | 'browser';

// ── Step / task status ────────────────────────────────────────────────────────

export type ExecutionStepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'retrying'
  | 'skipped'
  | 'cancelled';

export type ExecutionSessionStatus =
  | 'idle'
  | 'planning'
  | 'running'
  | 'completed'
  | 'failed';

// ── Plan types ────────────────────────────────────────────────────────────────

export interface ExecutionTask {
  readonly taskId:      string;
  readonly kind:        TaskKind;
  readonly description: string;
  readonly input:       Record<string, unknown>;
  readonly dependsOn?:  string[];
  readonly optional?:   boolean;
}

export interface ExecutionPlan {
  readonly planId: string;
  readonly tasks:  ExecutionTask[];
}

// ── Step (runtime unit dispatched to a tool) ──────────────────────────────────

export interface ExecutionStep {
  readonly stepId:    string;
  readonly taskId:    string;
  readonly toolName:  string;
  readonly toolInput: Record<string, unknown>;
}

// ── Runtime wrappers ──────────────────────────────────────────────────────────

export interface RuntimeStep {
  readonly step:   ExecutionStep;
  status:          ExecutionStepStatus;
  retryCount:      number;
  startedAt?:      Date;
  completedAt?:    Date;
  output?:         unknown;
  error?:          string;
}

// ── Execution context ─────────────────────────────────────────────────────────

export interface ExecutorExecutionContext {
  readonly runId:       string;
  readonly projectId:   string;
  readonly sandboxRoot: string;
  readonly sessionId:   string;
  readonly memoryContext?: string;
  readonly signal?:     AbortSignal;
}

// ── Session ───────────────────────────────────────────────────────────────────

export interface ExecutorSession {
  readonly sessionId:   string;
  readonly runId:       string;
  readonly projectId:   string;
  status:               ExecutionSessionStatus;
  readonly startedAt:   Date;
  endedAt?:             Date;
  tasksTotal:           number;
  tasksDone:            number;
}

// ── Agent input / result ──────────────────────────────────────────────────────

export interface ExecutorAgentInput {
  readonly runId:       string;
  readonly projectId:   string;
  readonly sandboxRoot: string;
  readonly plan:        ExecutionPlan;
  readonly options?:    ExecutorLoopOptions;
}

export interface ExecutorAgentResult {
  ok:              boolean;
  runId:           string;
  sessionId:       string;
  tasksTotal:      number;
  tasksCompleted:  number;
  tasksFailed:     number;
  durationMs:      number;
  outputs:         TaskOutput[];
  error?:          string;
}

// ── Task output ───────────────────────────────────────────────────────────────

export interface TaskOutput {
  taskId:   string;
  kind:     TaskKind;
  ok:       boolean;
  output?:  unknown;
  error?:   string;
  attempts: number;
}

// ── Loop options ──────────────────────────────────────────────────────────────

export interface ExecutorLoopOptions {
  stopOnFailure?: boolean;
  retry?:         ExecutorRetryConfig;
}

// ── Retry config ──────────────────────────────────────────────────────────────

export interface ExecutorRetryConfig {
  maxAttempts: number;
  delayMs:     number;
  backoff:     'none' | 'linear' | 'exponential';
}

// ── Tool routing ──────────────────────────────────────────────────────────────

export interface RoutedStep {
  toolName:  string;
  toolInput: Record<string, unknown>;
}

// ── Failure record ────────────────────────────────────────────────────────────

export interface ExecutionFailureRecord {
  stepId:     string;
  taskId:     string;
  runId:      string;
  kind:       TaskKind;
  toolName:   string;
  error:      string;
  retryCount: number;
  timestamp:  Date;
}

// ── Execution plan (built by planner) ────────────────────────────────────────

export interface BuiltExecutionPlan {
  readonly planId:     string;
  readonly runId:      string;
  readonly steps:      ExecutionStep[];
  readonly totalSteps: number;
}

// ── Monitor snapshot ──────────────────────────────────────────────────────────

export interface ExecutionMonitorSnapshot {
  runId:          string;
  sessionId:      string;
  status:         ExecutionSessionStatus;
  tasksTotal:     number;
  tasksDone:      number;
  activeStepId?:  string;
  stuckStepId?:   string;
  progressPct:    number;
}
