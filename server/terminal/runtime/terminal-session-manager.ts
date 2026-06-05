/**
 * server/terminal/runtime/terminal-session-manager.ts
 *
 * In-memory registry for TerminalSession instances.
 * Single source of truth for active terminal sessions.
 */

import { randomBytes }      from 'crypto';
import { existsSync }       from 'fs';
import {
  createSession,
  closeSession,
  markRunning,
  markIdle,
} from '../domain/entities/terminal-session.ts';
import type { TerminalSession } from '../domain/entities/terminal-session.ts';
import { makeSessionCreated, makeSessionClosed } from '../events/session-events.ts';

export class SessionManagerError extends Error {
  constructor(message: string) {
    super(`[terminal-session-manager] ${message}`);
    this.name = 'SessionManagerError';
  }
}

type EventCallback<T> = (payload: T) => void;

const _sessions   = new Map<string, TerminalSession>();
const _onCreate:  Array<EventCallback<ReturnType<typeof makeSessionCreated>>> = [];
const _onClose:   Array<EventCallback<ReturnType<typeof makeSessionClosed>>>  = [];

function genId(): string {
  return `sess_${randomBytes(6).toString('hex')}`;
}

export const terminalSessionManager = {
  create(projectId: number, cwd: string, env: Record<string, string> = {}): TerminalSession {
    if (!existsSync(cwd)) throw new SessionManagerError(`cwd does not exist: ${cwd}`);
    const session = createSession(genId(), projectId, cwd, env);
    _sessions.set(session.id, session);
    const payload = makeSessionCreated(session.id, projectId, cwd);
    _onCreate.forEach(fn => fn(payload));
    return session;
  },

  get(sessionId: string): TerminalSession | undefined {
    return _sessions.get(sessionId);
  },

  require(sessionId: string): TerminalSession {
    const s = _sessions.get(sessionId);
    if (!s) throw new SessionManagerError(`Session not found: ${sessionId}`);
    return s;
  },

  list(projectId?: number): TerminalSession[] {
    const all = [..._sessions.values()];
    return projectId !== undefined ? all.filter(s => s.projectId === projectId) : all;
  },

  markRunning(sessionId: string): void {
    const s = this.require(sessionId);
    _sessions.set(sessionId, markRunning(s));
  },

  markIdle(sessionId: string): void {
    const s = this.require(sessionId);
    _sessions.set(sessionId, markIdle(s));
  },

  updateCwd(sessionId: string, cwd: string): void {
    const s = this.require(sessionId);
    if (!existsSync(cwd)) throw new SessionManagerError(`cwd does not exist: ${cwd}`);
    _sessions.set(sessionId, { ...s, cwd, updatedAt: Date.now() });
  },

  close(sessionId: string): boolean {
    const s = _sessions.get(sessionId);
    if (!s) return false;
    _sessions.set(sessionId, closeSession(s));
    const payload = makeSessionClosed(sessionId, s.projectId);
    _onClose.forEach(fn => fn(payload));
    _sessions.delete(sessionId);
    return true;
  },

  onSessionCreated(fn: EventCallback<ReturnType<typeof makeSessionCreated>>): void {
    _onCreate.push(fn);
  },

  onSessionClosed(fn: EventCallback<ReturnType<typeof makeSessionClosed>>): void {
    _onClose.push(fn);
  },

  count(): number { return _sessions.size; },
};
