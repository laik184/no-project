/**
 * server/terminal/contracts/terminal-state.ts
 *
 * State enumerations and snapshot types for the terminal module.
 */

export type SessionStatus = 'idle' | 'running' | 'error' | 'closed';
export type RuntimeStatus = 'stopped' | 'starting' | 'running' | 'crashed' | 'restarting';
export type LogSource     = 'stdout' | 'stderr' | 'system';
export type LogLevel      = 'error' | 'warn' | 'info' | 'debug' | 'unknown';

export interface TerminalState {
  sessionId:     string;
  projectId:     number;
  sessionStatus: SessionStatus;
  runtimeStatus: RuntimeStatus;
  pid:           number | null;
  cwd:           string;
  updatedAt:     number;
}

export interface StreamFrame {
  type:      'stdout' | 'stderr' | 'exit' | 'error' | 'system';
  sessionId: string;
  line:      string;
  timestamp: number;
  exitCode?: number;
}
