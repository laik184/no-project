import type { VerificationSession, VerificationInput, VerificationStatus } from '../types/verifier.types.ts';
import { randomUUID } from 'node:crypto';

const sessions = new Map<string, VerificationSession>();

export function createSession(input: VerificationInput): VerificationSession {
  const session: VerificationSession = {
    id:        randomUUID(),
    runId:     input.runId,
    projectId: input.projectId,
    status:    'pending',
    startedAt: new Date(),
    phases:    input.phases,
    results:   [],
  };
  sessions.set(input.runId, session);
  return session;
}

export function getSession(runId: string): VerificationSession | undefined {
  return sessions.get(runId);
}

export function requireSession(runId: string): VerificationSession {
  const s = sessions.get(runId);
  if (!s) throw new Error(`[verification-session] No session for runId: ${runId}`);
  return s;
}

export function updateSessionStatus(runId: string, status: VerificationStatus): void {
  const s = requireSession(runId);
  s.status = status;
}

export function removeSession(runId: string): void {
  sessions.delete(runId);
}

export function listActiveSessions(): VerificationSession[] {
  return Array.from(sessions.values()).filter((s) =>
    s.status === 'pending' || s.status === 'running',
  );
}
