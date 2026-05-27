export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export type StepType =
  | 'generate_frontend'
  | 'generate_backend'
  | 'generate_api'
  | 'generate_database'
  | 'generate_auth'
  | 'generate_component'
  | 'write_file'
  | 'edit_file'
  | 'npm_install'
  | 'npm_run'
  | 'run_command'
  | 'validate_output'
  | 'checkpoint';

export interface StepInput {
  filePath?:    string;
  fileContent?: string;
  command?:     string;
  args?:        string[];
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
