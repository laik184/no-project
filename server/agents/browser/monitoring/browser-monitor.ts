/**
 * server/agents/browser/monitoring/browser-monitor.ts
 *
 * Tracks active browser sessions, execution progress, and stuck loops.
 * Read-only view over browser-state.ts and browser-context.ts.
 */

import { listActiveSessions, getActiveSessionCount } from '../core/browser-state.ts';
import { getContext }                                 from '../core/browser-context.ts';
import type { BrowserSession }                        from '../types/browser.types.ts';

export interface SessionHealth {
  sessionId:  string;
  runId:      string;
  status:     string;
  stepsCount: number;
  currentStatus: string;
  ageMs:      number;
  stuckMs?:   number;
}

export interface MonitorSnapshot {
  activeSessions: number;
  sessions:       SessionHealth[];
  stuckSessions:  SessionHealth[];
  capturedAt:     string;
}

// ── Stuck detection ───────────────────────────────────────────────────────────

const STUCK_THRESHOLD_MS = 60_000; // 60 s without a status update

function isStuck(session: BrowserSession): boolean {
  if (!session.launchedAt) return false;
  const ageMs = Date.now() - session.launchedAt.getTime();
  return ageMs > STUCK_THRESHOLD_MS && session.status === 'active';
}

// ── Health builder ────────────────────────────────────────────────────────────

function buildHealth(session: BrowserSession): SessionHealth {
  const ctx       = getContext(session.runId);
  const ageMs     = session.launchedAt
    ? Date.now() - session.launchedAt.getTime()
    : 0;
  const stuckMs   = isStuck(session) ? ageMs : undefined;

  return {
    sessionId:     session.sessionId,
    runId:         session.runId,
    status:        session.status,
    stepsCount:    ctx?.steps.length ?? 0,
    currentStatus: ctx?.status       ?? 'unknown',
    ageMs,
    stuckMs,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function snapshotMonitor(): MonitorSnapshot {
  const sessions       = listActiveSessions().map(buildHealth);
  const stuckSessions  = sessions.filter(s => s.stuckMs !== undefined);

  return {
    activeSessions: getActiveSessionCount(),
    sessions,
    stuckSessions,
    capturedAt:     new Date().toISOString(),
  };
}

export function getActiveCount(): number {
  return getActiveSessionCount();
}

export function isSessionStuck(sessionId: string): boolean {
  const sessions = listActiveSessions();
  const session  = sessions.find(s => s.sessionId === sessionId);
  return session ? isStuck(session) : false;
}

export function getStuckSessions(): SessionHealth[] {
  return listActiveSessions().map(buildHealth).filter(s => s.stuckMs !== undefined);
}
