/**
 * server/tools/browser/browser-session-store.ts
 *
 * In-process store for active Playwright browser sessions.
 * Keyed by runId — one session per agent run.
 */

export interface BrowserSession {
  sessionId:  string;
  runId:      string;
  browser:    import('playwright').Browser;
  page:       import('playwright').Page;
  createdAt:  number;
}

const sessions = new Map<string, BrowserSession>();

export function setSession(runId: string, session: BrowserSession): void {
  sessions.set(runId, session);
}

export function getSession(runId: string): BrowserSession | undefined {
  return sessions.get(runId);
}

export function deleteSession(runId: string): boolean {
  return sessions.delete(runId);
}

export function hasSession(runId: string): boolean {
  return sessions.has(runId);
}

export function sessionCount(): number {
  return sessions.size;
}
