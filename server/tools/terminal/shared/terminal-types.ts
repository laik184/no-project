export type ExitCodeCategory = 'success' | 'error' | 'signal' | 'timeout';

export interface ExecutionResult {
  command:    string;
  stdout:     string;
  stderr:     string;
  exitCode:   number;
  durationMs: number;
  success:    boolean;
  timedOut?:  boolean;
}

export interface ExecutionOptions {
  runId:      string;
  projectId:  string;
  command:    string;
  timeoutMs?: number;
  stream?:    boolean;
  env?:       Record<string, string>;
}

export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
}

export interface ValidationResult {
  valid:    boolean;
  errors:   string[];
  warnings: string[];
}

export interface PortAllocation {
  port:       number;
  runId:      string;
  projectId:  string;
  reservedAt: Date;
}

export interface ProcessRecord {
  id:        string;
  runId:     string;
  projectId: string;
  command:   string;
  pid:       number;
  status:    'running' | 'stopped' | 'crashed' | 'killed';
  startedAt: Date;
  exitCode?: number;
}

export interface ProcessHistoryEntry {
  id:        string;
  runId:     string;
  command:   string;
  pid:       number;
  exitCode:  number;
  durationMs: number;
  startedAt:  Date;
  endedAt:    Date;
}
