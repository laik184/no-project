export type ExitCodeCategory = 'success' | 'error' | 'signal' | 'timeout';

export interface ValidatedCommand {
  executable: string;
  args:       string[];
  raw:        string;
}

export interface ExecutionResult {
  command:    string;
  stdout:     string;
  stderr:     string;
  exitCode:   number;
  durationMs: number;
  success:    boolean;
}

export interface ExecutionOptions {
  runId:      string;
  projectId:  string;
  command:    string;
  timeoutMs?: number;
  stream?:    boolean;
}

export interface ValidationResult {
  valid:    boolean;
  errors:   string[];
  warnings: string[];
}

export interface PolicyDecision {
  allowed: boolean;
  reason?:  string;
}
