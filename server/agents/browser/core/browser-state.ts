/**
 * browser-state.ts
 * In-memory registry of active browser sessions — single source of truth for session state.
 */

import { randomUUID }              from 'crypto';
import type { BrowserSession,
              BrowserSessionStatus } from '../types/browser.types.ts';

const sessions = new Map<string, BrowserSession>();

export function createSession(runId: string, projectId?: number): BrowserSession {
  const sessionId = `bsess-${randomUUID().slice(0, 8)}`;
  const session: BrowserSession = {
    sessionId,
    runId,
    projectId,
    status:    'idle',
    pagesOpen: 0,
  };
  sessions.set(sessionId, session);
  return session;
}

export function transitionSession(sessionId: string, status: BrowserSessionStatus): void {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`[browser-state] Unknown session: ${sessionId}`);
  session.status = status;
  if (status === 'launching') session.launchedAt = new Date();
  if (status === 'closed' || status === 'crashed') session.closedAt = new Date();
}

export function incrementPages(sessionId: string): void {
  const s = sessions.get(sessionId);
  if (s) s.pagesOpen++;
}

export function decrementPages(sessionId: string): void {
  const s = sessions.get(sessionId);
  if (s) s.pagesOpen = Math.max(0, s.pagesOpen - 1);
}

export function getSession(sessionId: string): BrowserSession | undefined {
  return sessions.get(sessionId);
}

export function listActiveSessions(): BrowserSession[] {
  return Array.from(sessions.values()).filter(
    (s) => s.status === 'ready' || s.status === 'launching',
  );
}

export function removeSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function getSessionCount(): number {
  return sessions.size;
}
