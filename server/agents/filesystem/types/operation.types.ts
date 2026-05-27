import type { OperationType } from './filesystem.types.ts';

export interface OperationRequest {
  id:        string;
  runId:     string;
  projectId: string;
  type:      OperationType;
  path:      string;
  content?:  string;
  oldString?: string;
  newString?: string;
  query?:    string;
  recursive?: boolean;
}

export interface OperationResult {
  id:        string;
  type:      OperationType;
  success:   boolean;
  output?:   string;
  error?:    string;
  durationMs: number;
}
