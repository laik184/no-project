export type ServerState  = 'up' | 'down' | 'unknown';
export type CrashReason  = 'oom' | 'exception' | 'timeout' | 'signal' | 'unknown';

export interface RuntimeCheckResult {
  healthy:         boolean;
  state:           ServerState;
  responseTimeMs?: number;
  error?:          string;
  checkedAt:       Date;
}

export interface EndpointCheckResult {
  path:           string;
  method:         string;
  status:         number;
  expectedStatus: number;
  passed:         boolean;
  responseTimeMs: number;
  error?:         string;
  body?:          unknown;
}

export interface CrashReport {
  detected:    boolean;
  reason?:     CrashReason;
  exitCode?:   number;
  signal?:     string;
  lastLines:   string[];
  detectedAt?: Date;
}

export interface ServerHealth {
  state:     ServerState;
  pid?:      number;
  port?:     number;
  uptimeMs?: number;
  memoryMb?: number;
  checks:    RuntimeCheckResult[];
}
