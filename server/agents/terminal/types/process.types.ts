export type ProcessStatus = 'running' | 'stopped' | 'crashed' | 'killed' | 'timeout';

export interface ProcessRecord {
  id:        string;
  runId:     string;
  command:   string;
  pid:       number;
  status:    ProcessStatus;
  startedAt: Date;
  stoppedAt?: Date;
  exitCode?:  number;
}

export interface ProcessStartOptions {
  command:   string;
  cwd:       string;
  env?:      NodeJS.ProcessEnv;
  timeoutMs?: number;
}

export interface ProcessStopResult {
  id:        string;
  pid:       number;
  signal:    string;
  stoppedAt: Date;
}

export interface ProcessHistoryEntry {
  processId: string;
  runId:     string;
  command:   string;
  exitCode:  number;
  durationMs:number;
  status:    ProcessStatus;
  timestamp: Date;
}
