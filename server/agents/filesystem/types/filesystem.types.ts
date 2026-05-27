export type OperationType =
  | 'read_file'
  | 'write_file'
  | 'delete_file'
  | 'move_file'
  | 'patch_file'
  | 'read_folder'
  | 'create_folder'
  | 'delete_folder'
  | 'search_text'
  | 'search_regex'
  | 'snapshot'
  | 'restore';

export type OperationStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface FilesystemAgentState {
  runId:      string;
  projectId:  string;
  sandboxRoot: string;
  opsCompleted: number;
  opsFailed:    number;
  startedAt:    Date;
}

export interface OperationRecord {
  id:        string;
  type:      OperationType;
  path:      string;
  status:    OperationStatus;
  durationMs?: number;
  error?:    string;
  createdAt: Date;
}
