/**
 * server/terminal/events/session-events.ts
 *
 * Session lifecycle event payloads and factory helpers.
 */

export interface SessionCreatedPayload {
  sessionId: string;
  projectId: number;
  cwd:       string;
  timestamp: number;
}

export interface SessionClosedPayload {
  sessionId: string;
  projectId: number;
  timestamp: number;
}

export interface SessionCwdChangedPayload {
  sessionId: string;
  oldCwd:    string;
  newCwd:    string;
  timestamp: number;
}

export function makeSessionCreated(
  sessionId: string,
  projectId: number,
  cwd:       string,
): SessionCreatedPayload {
  return { sessionId, projectId, cwd, timestamp: Date.now() };
}

export function makeSessionClosed(
  sessionId: string,
  projectId: number,
): SessionClosedPayload {
  return { sessionId, projectId, timestamp: Date.now() };
}

export function makeSessionCwdChanged(
  sessionId: string,
  oldCwd:    string,
  newCwd:    string,
): SessionCwdChangedPayload {
  return { sessionId, oldCwd, newCwd, timestamp: Date.now() };
}
