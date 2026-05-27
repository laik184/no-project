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
  oldString?:   string;    // for patch_file / edit_file (surgical replacement)
  newString?:   string;    // for patch_file / edit_file
  command?:     string;
  args?:        string[];
  query?:       string;    // for search_files
  recursive?:   boolean;  // for list_directory
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
  diskPath?:     string;   // path to persisted checkpoint on disk
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
