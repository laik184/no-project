import type { ExecutorSession, ExecutorStatus } from '../types/executor.types.ts';
import { generateSessionId } from '../utils/execution-helpers.ts';

const sessions = new Map<string, ExecutorSession>();

export function createSession(runId: string, projectId: string, tasksTotal: number): ExecutorSession {
  const session: ExecutorSession = {
    sessionId:  generateSessionId(),
    runId,
    projectId,
    status:     'idle',
    startedAt:  new Date(),
    tasksTotal,
    tasksDone:  0,
  };
  sessions.set(session.sessionId, session);
  return session;
}

export function startSession(sessionId: string): void {
  const s = sessions.get(sessionId);
  if (!s) throw new Error(`Session not found: ${sessionId}`);
  s.status = 'running';
}

export function completeSession(sessionId: string): void {
  const s = sessions.get(sessionId);
  if (!s) return;
  s.status  = 'completed';
  s.endedAt = new Date();
}

export function failSession(sessionId: string): void {
  const s = sessions.get(sessionId);
  if (!s) return;
  s.status  = 'failed';
  s.endedAt = new Date();
}

export function updateTaskCount(sessionId: string, done: number): void {
  const s = sessions.get(sessionId);
  if (s) s.tasksDone = done;
}

export function removeSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function getSession(sessionId: string): ExecutorSession | undefined {
  return sessions.get(sessionId);
}

export function listActiveSessions(): ExecutorSession[] {
  return Array.from(sessions.values()).filter(
    (s) => s.status === 'running' || s.status === 'idle',
  );
}
