/**
 * server/agents/terminal/types/terminal.types.ts
 *
 * All shared types for the terminal agent orchestration layer.
 * Zero imports from tool layer — types only.
 */

// ── Execution phase ───────────────────────────────────────────────────────────

export type TerminalPhase =
  | 'idle'
  | 'validating'
  | 'routing'
  | 'executing'
  | 'retrying'
  | 'recovering'
  | 'completing'
  | 'failed';

export type SessionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'aborted';

// ── Execution step ────────────────────────────────────────────────────────────

export type StepType =
  | 'run_command'
  | 'npm_install'
  | 'npm_run'
  | 'npm_build'
  | 'npm_test'
  | 'write_file'
  | 'read_file'
  | 'patch_file'
  | 'delete_file'
  | 'list_directory'
  | 'search_files'
  | 'process_start'
  | 'process_stop'
  | 'resolve_port'
  | 'checkpoint'
  | 'validate_output';

export interface ExecutionStep {
  id:         string;
  type:       StepType;
  taskId:     string;
  label:      string;
  timeoutMs:  number;
  retryLimit: number;
  input:      Record<string, unknown>;
}

// ── Step result ───────────────────────────────────────────────────────────────

export interface StepOutcome {
  stepId:     string;
  success:    boolean;
  durationMs: number;
  output?:    string;
  filePath?:  string;
  error?:     string;
  attempt:    number;
}

// ── Command & npm types ───────────────────────────────────────────────────────

export interface CommandResult {
  exitCode: number;
  stdout:   string;
  stderr:   string;
}

export interface CommandRunOptions {
  command:    string;
  projectId:  string;
  timeoutMs?: number;
  env?:       Record<string, string>;
}

export interface NpmOptions {
  packages?:  string[];
  dev?:       boolean;
  script?:    string;
  projectId:  string;
  timeoutMs?: number;
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid:    boolean;
  errors:   string[];
  warnings: string[];
}

// ── Session & context ─────────────────────────────────────────────────────────

export interface TerminalSessionMeta {
  runId:       string;
  projectId:   string;
  sandboxRoot: string;
  startedAt:   Date;
  status:      SessionStatus;
  phase:       TerminalPhase;
  totalSteps:  number;
  completedSteps: number;
  failedSteps: number;
}

// ── Retry ─────────────────────────────────────────────────────────────────────

export interface RetryPolicy {
  maxAttempts: number;
  delayMs:     number;
  backoff:     'none' | 'linear' | 'exponential';
}

export type RecoveryAction = 'retry' | 'skip' | 'abort';
