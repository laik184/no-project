/**
 * types/runtime.types.ts
 * Runtime verification type definitions.
 */

export type ServerState = 'starting' | 'running' | 'unhealthy' | 'crashed' | 'unknown';

/** All reasons a process can crash — must include all values used by tools. */
export type CrashReason =
  | 'oom'
  | 'port_conflict'
  | 'startup_failure'
  | 'signal'
  | 'exception'
  | 'timeout'
  | 'unknown';

export interface ServerHealth {
  healthy:       boolean;
  state:         ServerState;
  port:          number;
  respondingMs?: number;
  statusCode?:   number;
  error?:        string;
}

export interface RuntimeCheckResult {
  healthy:   boolean;
  state:     ServerState;
  details:   string;
  checkedAt: Date;
  errors:    string[];
  /** Convenience alias for errors[0] */
  error?:    string;
}

export interface EndpointCheckResult {
  path:           string;
  method:         string;
  expectedStatus: number;
  actualStatus:   number;
  passed:         boolean;
  durationMs:     number;
  error?:         string;
  body?:          unknown;
}

export interface CrashReport {
  /** Whether a crash was detected. Optional alias for detected. */
  crashed?:    boolean;
  /** Primary field — true if a crash was detected. */
  detected:    boolean;
  reason?:     CrashReason;
  exitCode?:   number;
  signal?:     string;
  stderr?:     string;
  lastLines?:  string[];
  detectedAt?: Date;
}
