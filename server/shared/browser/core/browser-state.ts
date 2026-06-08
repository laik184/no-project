/**
 * server/agents/browser/core/browser-state.ts
 *
 * Module-level registry of all browser sessions (active + historical).
 * Single source of truth for session lifecycle state.
 * Consumed by browser routes API and monitoring layer.
 */

import type { BrowserSession, LiveBrowserSession } from '../types/browser.types.ts';

// ── Internal store ────────────────────────────────────────────────────────────

const _sessions = new Map<string, BrowserSession>();

// ── Writes (called by browser-session.ts only) ────────────────────────────────

export function recordSessionOpened(
  live:      LiveBrowserSession,
  projectId?: number,
): void {
  _sessions.set(live.sessionId, {
    sessionId:  live.sessionId,
    runId:      live.runId,
    projectId,
    status:     'active',
    pagesOpen:  1,
    launchedAt: live.launchedAt,
  });
}

export function recordSessionClosed(sessionId: string, _runId: string): void {
  const s = _sessions.get(sessionId);
  if (!s) return;
  _sessions.set(sessionId, {
    ...s,
    status:    'closed',
    pagesOpen: 0,
    closedAt:  new Date(),
  });
}

export function recordSessionCrashed(
  sessionId: string,
  _runId:    string,
  error:     string,
): void {
  const s = _sessions.get(sessionId);
  if (!s) return;
  _sessions.set(sessionId, {
    ...s,
    status:    'crashed',
    pagesOpen: 0,
    closedAt:  new Date(),
    error,
  });
}

export function updateSessionUrl(sessionId: string, url: string): void {
  const s = _sessions.get(sessionId);
  if (s) _sessions.set(sessionId, { ...s, url });
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export function listActiveSessions(): BrowserSession[] {
  return [..._sessions.values()].filter(s => s.status === 'active');
}

export function getAllSessions(): BrowserSession[] {
  return [..._sessions.values()];
}

export function getSession(sessionId: string): BrowserSession | undefined {
  return _sessions.get(sessionId);
}

export function getSessionCount(): number {
  return _sessions.size;
}

export function getActiveSessionCount(): number {
  return listActiveSessions().length;
}
