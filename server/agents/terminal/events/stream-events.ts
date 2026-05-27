export interface StreamStartedEvent {
  runId:     string;
  command:   string;
  timestamp: Date;
}

export interface StreamChunkEvent {
  runId:     string;
  chunk:     string;
  type:      'stdout' | 'stderr';
  lineCount: number;
  timestamp: Date;
}

export interface StreamCompletedEvent {
  runId:      string;
  command:    string;
  exitCode:   number;
  byteCount:  number;
  durationMs: number;
  truncated:  boolean;
  timestamp:  Date;
}

export interface StreamErrorEvent {
  runId:     string;
  error:     string;
  timestamp: Date;
}
