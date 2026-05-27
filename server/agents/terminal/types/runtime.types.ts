export type RunId      = string;
export type ProjectId  = string;
export type ProcessId  = string;

export type RuntimeStatus =
  | 'idle'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'crashed'
  | 'recovering'
  | 'timed_out';

export interface RuntimeContext {
  runId:      RunId;
  projectId:  ProjectId;
  cwd:        string;
  env?:       NodeJS.ProcessEnv;
  timeoutMs?: number;
}

export interface RuntimeHealth {
  runId:       RunId;
  stepsTotal:  number;
  stepsPassed: number;
  stepsFailed: number;
  failureRate: number;
  healthy:     boolean;
  lastChecked: Date;
}

export interface ResourceSnapshot {
  memoryUsedMb:    number;
  cpuPercent:      number;
  activeProcesses: number;
  capturedAt:      Date;
}
