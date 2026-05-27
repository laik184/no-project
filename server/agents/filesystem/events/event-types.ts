import type { OperationType, OperationStatus } from '../types/filesystem.types.ts';

export interface FsOperationStarted {
  runId:     string;
  projectId: string;
  opId:      string;
  type:      OperationType;
  path:      string;
}

export interface FsOperationCompleted {
  runId:     string;
  projectId: string;
  opId:      string;
  type:      OperationType;
  path:      string;
  status:    OperationStatus;
  durationMs: number;
  error?:    string;
}

export interface FsFileChanged {
  runId:     string;
  projectId: string;
  path:      string;
  changeType: 'created' | 'updated' | 'deleted' | 'moved';
}

export interface FsAgentReady {
  runId:     string;
  projectId: string;
  sandboxRoot: string;
}
