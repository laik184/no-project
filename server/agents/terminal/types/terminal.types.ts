/**
 * server/agents/terminal/types/terminal.types.ts
 *
 * Core type contracts for the terminal agent orchestration layer.
 * No imports from execution tools — pure contracts only.
 */

export type SessionStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'aborted';

export type StepStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'skipped'
  | 'retrying';

export type RecoveryAction = 'retry' | 'skip' | 'abort';

export interface TerminalSessionMeta {
  readonly sessionId: string;
  readonly runId:     string;
  readonly projectId: string;
  readonly startedAt: number;
  taskCount:          number;
  completedCount:     number;
  failedCount:        number;
  status:             SessionStatus;
}

export interface ExecutionStep {
  readonly id:          string;
  readonly type:        string;
  readonly label:       string;
  readonly input:       Record<string, unknown>;
  readonly timeoutMs:   number;
  readonly taskId:      string;
  readonly retryPolicy: StepRetryPolicy;
}

export interface StepRetryPolicy {
  maxAttempts: number;
  delayMs:     number;
  backoff:     'none' | 'linear' | 'exponential';
}

export interface StepOutcome {
  readonly stepId:     string;
  readonly success:    boolean;
  readonly output?:    string;
  readonly error?:     string;
  readonly durationMs: number;
  readonly attempts:   number;
}

export interface RoutingDecision {
  readonly toolName:  string;
  readonly input:     Record<string, unknown>;
  readonly timeoutMs: number;
}

export interface ValidationResult {
  readonly valid:    boolean;
  readonly errors:   string[];
  readonly warnings: string[];
}

export interface CheckpointEntry {
  readonly id:          string;
  readonly runId:       string;
  readonly projectId:   string;
  readonly taskId:      string;
  readonly createdAt:   number;
}

export interface RuntimeHealth {
  readonly runId:        string;
  readonly taskCount:    number;
  readonly stepCount:    number;
  readonly failureCount: number;
  readonly isHealthy:    boolean;
  readonly checkedAt:    number;
}

export interface FailureRecord {
  readonly runId:     string;
  readonly stepId:    string;
  readonly error:     string;
  readonly attempts:  number;
  readonly recordedAt: number;
}

export interface DispatchRequest {
  readonly toolName:   string;
  readonly input:      Record<string, unknown>;
  readonly runId:      string;
  readonly projectId:  string;
  readonly sandboxRoot: string;
  readonly timeoutMs?: number;
}

export interface DispatchResponse<T = unknown> {
  readonly ok:         boolean;
  readonly data?:      T;
  readonly error?:     string;
  readonly code?:      string;
  readonly durationMs: number;
}

export interface CommandRunOptions {
  command:    string;
  cwd?:       string;
  timeoutMs?: number;
  env?:       Record<string, string>;
}

export interface NpmOptions {
  cwd?:       string;
  timeoutMs?: number;
}

export interface CommandResult {
  exitCode:   number;
  stdout:     string;
  stderr:     string;
  durationMs: number;
  success:    boolean;
}
