/**
 * server/infrastructure/runtime/runtime-types.ts
 *
 * Shared type definitions for the runtime manager and process registry.
 */

export type RuntimeStatus = 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'crashed';

export interface RuntimeEntry {
  readonly projectId:    number;
  pid?:                  number;
  port?:                 number;
  status:                RuntimeStatus;
  command:               string;
  startedAt:             number;
  restartCount:          number;
  logs:                  string[];
}

export interface RuntimeStartOptions {
  command:  string;
  env?:     Record<string, string>;
  port?:    number;
  cwd?:     string;
}

export interface RuntimeStartResult {
  ok:              boolean;
  pid?:            number;
  port?:           number;
  alreadyRunning?: boolean;
  error?:          string;
}

export interface RuntimeStopResult {
  ok:     boolean;
  error?: string;
}
