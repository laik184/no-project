/**
 * server/terminal/domain/entities/terminal-log.ts
 *
 * TerminalLog domain entity — one line of terminal output.
 */

import type { LogSource, LogLevel } from '../../contracts/terminal-state.ts';

export interface TerminalLog {
  id:        string;
  sessionId: string;
  projectId: number;
  line:      string;
  source:    LogSource;
  level:     LogLevel;
  timestamp: number;
}

export function createLog(
  id:        string,
  sessionId: string,
  projectId: number,
  line:      string,
  source:    LogSource,
  level:     LogLevel = 'unknown',
): TerminalLog {
  return { id, sessionId, projectId, line, source, level, timestamp: Date.now() };
}
