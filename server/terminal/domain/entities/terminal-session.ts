/**
 * server/terminal/domain/entities/terminal-session.ts
 *
 * TerminalSession domain entity.
 */

import type { SessionStatus } from '../../contracts/terminal-state.ts';

export interface TerminalSession {
  id:        string;
  projectId: number;
  cwd:       string;
  env:       Record<string, string>;
  status:    SessionStatus;
  createdAt: number;
  updatedAt: number;
}

export function createSession(
  id:        string,
  projectId: number,
  cwd:       string,
  env:       Record<string, string> = {},
): TerminalSession {
  const now = Date.now();
  return { id, projectId, cwd, env, status: 'idle', createdAt: now, updatedAt: now };
}

export function closeSession(session: TerminalSession): TerminalSession {
  return { ...session, status: 'closed', updatedAt: Date.now() };
}

export function markRunning(session: TerminalSession): TerminalSession {
  return { ...session, status: 'running', updatedAt: Date.now() };
}

export function markIdle(session: TerminalSession): TerminalSession {
  return { ...session, status: 'idle', updatedAt: Date.now() };
}
