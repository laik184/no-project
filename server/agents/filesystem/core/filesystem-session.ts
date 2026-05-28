/**
 * server/agents/filesystem/core/filesystem-session.ts
 *
 * Lifecycle management for filesystem agent sessions.
 * Sessions track per-run operation counts and status — no fs access.
 */

import type { FilesystemSession, FilesystemSessionStatus } from '../types/filesystem.types.ts';
import { generateSessionId, now }                          from '../utils/filesystem-utils.ts';

// ── Internal store ────────────────────────────────────────────────────────────

const _sessions = new Map<string, FilesystemSession>();

// ── Public API ────────────────────────────────────────────────────────────────

export function createSession(
  runId:           string,
  projectId:       string,
  operationsTotal: number,
): FilesystemSession {
  const session: FilesystemSession = {
    sessionId:       generateSessionId(),
    runId,
    projectId,
    status:          'idle',
    startedAt:       now(),
    operationsTotal,
    operationsDone:  0,
  };
  _sessions.set(session.sessionId, session);
  return session;
}

export function startSession(sessionId: string): void {
  const s = _sessions.get(sessionId);
  if (!s) throw new Error(`[filesystem-session] Session not found: ${sessionId}`);
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

export function incrementDone(sessionId: string): void {
  const s = _sessions.get(sessionId);
  if (s) s.operationsDone++;
}

export function getSession(sessionId: string): FilesystemSession | undefined {
  return _sessions.get(sessionId);
}

export function removeSession(sessionId: string): void {
  _sessions.delete(sessionId);
}

export function listActiveSessions(): FilesystemSession[] {
  return [..._sessions.values()].filter(
    (s) => s.status === 'running' || s.status === 'idle',
  );
}

export function sessionStatus(sessionId: string): FilesystemSessionStatus | undefined {
  return _sessions.get(sessionId)?.status;
}
