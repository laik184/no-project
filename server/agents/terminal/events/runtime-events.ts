export type RuntimeEventName =
  | 'terminal.execution.started'
  | 'terminal.execution.completed'
  | 'terminal.execution.failed'
  | 'terminal.stream.chunk'
  | 'process.crashed';

export interface TerminalExecutionStarted {
  runId:     string;
  command:   string;
  projectId: string;
  timestamp: Date;
}

export interface TerminalExecutionCompleted {
  runId:      string;
  command:    string;
  exitCode:   number;
  durationMs: number;
  timestamp:  Date;
}

export interface TerminalExecutionFailed {
  runId:     string;
  command:   string;
  error:     string;
  timestamp: Date;
}

export interface TerminalStreamChunk {
  runId:     string;
  chunk:     string;
  type:      'stdout' | 'stderr';
  timestamp: Date;
}

export interface ProcessCrashed {
  runId:     string;
  processId: string;
  pid:       number;
  exitCode:  number;
  timestamp: Date;
}

export interface RuntimeEventMap {
  'terminal.execution.started':   TerminalExecutionStarted;
  'terminal.execution.completed': TerminalExecutionCompleted;
  'terminal.execution.failed':    TerminalExecutionFailed;
  'terminal.stream.chunk':        TerminalStreamChunk;
  'process.crashed':              ProcessCrashed;
}
