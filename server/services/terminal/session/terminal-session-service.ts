/**
 * server/services/terminal/session/terminal-session-service.ts
 *
 * Terminal session lifecycle: create, get, update cwd, destroy.
 * A session groups a cwd, env, and history for a single terminal panel.
 */

import { randomBytes }               from 'crypto';
import { existsSync }                from 'fs';
import { terminalHistoryService }    from './terminal-history-service.ts';

export class SessionError extends Error {
  constructor(message: string) {
    super(`[terminal-session] ${message}`);
    this.name = 'SessionError';
  }
}

export interface TerminalSession {
  id:        string;
  projectId: number;
  cwd:       string;
  env:       Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

const _sessions = new Map<string, TerminalSession>();

function generateId(): string {
  return `sess_${randomBytes(6).toString('hex')}`;
}

export const terminalSessionService = {
  create(projectId: number, cwd: string, env: Record<string, string> = {}): TerminalSession {
    if (!existsSync(cwd)) {
      throw new SessionError(`Working directory does not exist: ${cwd}`);
    }

    const session: TerminalSession = {
      id:        generateId(),
      projectId,
      cwd,
      env,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    _sessions.set(session.id, session);
    return session;
  },

  get(sessionId: string): TerminalSession | undefined {
    return _sessions.get(sessionId);
  },

  require(sessionId: string): TerminalSession {
    const s = _sessions.get(sessionId);
    if (!s) throw new SessionError(`Session not found: ${sessionId}`);
    return s;
  },

  list(projectId?: number): TerminalSession[] {
    const all = [..._sessions.values()];
    return projectId !== undefined ? all.filter(s => s.projectId === projectId) : all;
  },

  updateCwd(sessionId: string, cwd: string): void {
    const s = this.require(sessionId);
    if (!existsSync(cwd)) throw new SessionError(`Directory does not exist: ${cwd}`);
    s.cwd       = cwd;
    s.updatedAt = Date.now();
  },

  setEnv(sessionId: string, key: string, value: string): void {
    const s  = this.require(sessionId);
    s.env[key] = value;
    s.updatedAt = Date.now();
  },

  destroy(sessionId: string): boolean {
    terminalHistoryService.clear(sessionId);
    return _sessions.delete(sessionId);
  },

  count(): number {
    return _sessions.size;
  },
};
