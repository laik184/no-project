/**
 * server/agents/coderx/core/coderx-session.ts
 *
 * Session lifecycle management for the CoderX agent.
 * Sessions track per-run task counts and status — no execution logic.
 */

import type { CoderXSession, CodingSessionStatus } from '../types/coderx.types.ts';
import { generateSessionId, now }                   from '../utils/coding-utils.ts';

const _sessions = new Map<string, CoderXSession>();

export function createSession(
  runId:      string,
  projectId:  string,
  requestId:  string,
  tasksTotal: number,
): CoderXSession {
  const session: CoderXSession = {
    sessionId:  generateSessionId(),
    runId,
    projectId,
    requestId,
    status:     'idle',
    startedAt:  now(),
    tasksTotal,
    tasksDone:  0,
  };
  _sessions.set(session.sessionId, session);
  return session;
}

export function advanceSession(sessionId: string, status: CodingSessionStatus): void {
  const s = _sessions.get(sessionId);
  if (!s) throw new Error(`[coderx-session] Not found: ${sessionId}`);
  s.status = status;
}

export function completeSession(sessionId: string): void {
  const s = _sessions.get(sessionId);
  if (!s) return;
  s.status  = 'completed';
  s.endedAt = now();
}

export function failSession(sessionId: string): void {
  const s = _sessions.get(sessionId);
  if (!s) return;
  s.status  = 'failed';
  s.endedAt = now();
}

export function incrementTaskDone(sessionId: string): void {
  const s = _sessions.get(sessionId);
  if (s) s.tasksDone++;
}

export function getSession(sessionId: string): CoderXSession | undefined {
  return _sessions.get(sessionId);
}

export function removeSession(sessionId: string): void {
  _sessions.delete(sessionId);
}

export function listActiveSessions(): CoderXSession[] {
  return [..._sessions.values()].filter(
    (s) => s.status !== 'completed' && s.status !== 'failed',
  );
}

export function sessionStatus(sessionId: string): CodingSessionStatus | undefined {
  return _sessions.get(sessionId)?.status;
}
