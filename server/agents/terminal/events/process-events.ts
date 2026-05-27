import type { ProcessStatus } from '../types/process.types.ts';

export interface ProcessRegisteredEvent {
  processId: string;
  runId:     string;
  pid:       number;
  command:   string;
  timestamp: Date;
}

export interface ProcessStatusChangedEvent {
  processId:  string;
  runId:      string;
  prevStatus: ProcessStatus;
  newStatus:  ProcessStatus;
  timestamp:  Date;
}

export interface ProcessExitedEvent {
  processId:  string;
  runId:      string;
  pid:        number;
  exitCode:   number;
  durationMs: number;
  timestamp:  Date;
}
