/**
 * server/tools/browser/session/browser-context.ts
 *
 * Module-level session store: maps runId → LiveBrowserSession.
 * Tools look up the active page by runId from their execution context.
 * Fail-closed: getSession() throws if no session exists for the runId.
 */

import type { LiveBrowserSession } from '../../../shared/browser/core/browser-session.ts';
import { noSessionError }          from '../shared/browser-errors.ts';

const sessions = new Map<string, LiveBrowserSession>();

export function storeSession(runId: string, live: LiveBrowserSession): void {
  sessions.set(runId, live);
}

export function removeSession(runId: string): void {
  sessions.delete(runId);
}

export function getSession(runId: string): LiveBrowserSession {
  const live = sessions.get(runId);
  if (!live) throw noSessionError(runId);
  return live;
}

export function hasSession(runId: string): boolean {
  return sessions.has(runId);
}

export function activeSessionCount(): number {
  return sessions.size;
}
