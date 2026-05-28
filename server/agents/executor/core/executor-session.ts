/**
 * server/agents/executor/core/executor-session.ts
 *
 * Session lifecycle management for the executor agent.
 * Sessions track per-run task counts and status — no execution logic.
 */

import type { ExecutorSession, ExecutionSessionStatus } from '../types/executor.types.ts';
import { generateSessionId, now }                       from '../utils/execution-utils.ts';

const _sessions = new Map<string, ExecutorSession>();

export function createSession(runId: string, projectId: string, tasksTotal: number): ExecutorSession {
  const session: ExecutorSession = {
    sessionId:  generateSessionId(),
    runId, projectId,
    status:     'idle',
    startedAt:  now(),
    tasksTotal,
    tasksDone:  0,
  };
  _sessions.set(session.sessionId, session);
  return session;
}

export function startSession(sessionId: string): void {
  const s = _sessions.get(sessionId);
  if (!s) throw new Error(`[executor-session] Not found: ${sessionId}`);
  s.status = 'running';
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

export function getSession(sessionId: string): ExecutorSession | undefined {
  return _sessions.get(sessionId);
}

export function removeSession(sessionId: string): void {
  _sessions.delete(sessionId);
}

export function listActiveSessions(): ExecutorSession[] {
  return [..._sessions.values()].filter((s) => s.status === 'running' || s.status === 'idle');
}

export function sessionStatus(sessionId: string): ExecutionSessionStatus | undefined {
  return _sessions.get(sessionId)?.status;
}
