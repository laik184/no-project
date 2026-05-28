/**
 * server/orchestration/core/orchestration-session.ts
 *
 * Creates and manages orchestration session lifecycle.
 * Sessions are lightweight in-memory tracking objects — no tool execution.
 */

import type { OrchestrationSession, OrchestrationStatus } from '../types/orchestration.types.ts';
import { newSessionId, now } from '../utils/orchestration-utils.ts';

// ── Store ─────────────────────────────────────────────────────────────────────

const _sessions = new Map<string, OrchestrationSession>();

// ── Factory ───────────────────────────────────────────────────────────────────

export function createSession(
  orchestrationId: string,
  runId:           string,
  projectId:       string,
  workflowsTotal:  number,
): OrchestrationSession {
  const session: OrchestrationSession = {
    sessionId:       newSessionId(),
    orchestrationId,
    runId,
    projectId,
    status:          'idle',
    startedAt:       now(),
    workflowsTotal,
    workflowsDone:   0,
  };
  _sessions.set(session.sessionId, session);
  return session;
}

// ── State transitions ─────────────────────────────────────────────────────────

export function transitionSession(
  sessionId: string,
  status:    OrchestrationStatus,
): void {
  const s = _sessions.get(sessionId);
  if (!s) return;
  s.status = status;
  if (['completed', 'failed', 'cancelled', 'escalated'].includes(status)) {
    s.endedAt = now();
  }
}

export function incrementWorkflowsDone(sessionId: string): void {
  const s = _sessions.get(sessionId);
  if (s) s.workflowsDone++;
}

export function failSession(sessionId: string): void {
  transitionSession(sessionId, 'failed');
}

export function completeSession(sessionId: string): void {
  transitionSession(sessionId, 'completed');
}

// ── Read API ──────────────────────────────────────────────────────────────────

export function getSession(sessionId: string): OrchestrationSession | undefined {
  return _sessions.get(sessionId);
}

export function getSessionByOrchestrationId(
  orchestrationId: string,
): OrchestrationSession | undefined {
  for (const s of _sessions.values()) {
    if (s.orchestrationId === orchestrationId) return s;
  }
  return undefined;
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export function deleteSession(sessionId: string): void {
  _sessions.delete(sessionId);
}
