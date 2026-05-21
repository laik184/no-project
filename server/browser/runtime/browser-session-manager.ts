/**
 * server/browser/runtime/browser-session-manager.ts
 * Manages Playwright browser lifecycle per validation session.
 * Single responsibility: launch/close browser. No validation logic.
 */

import { v4 as uuidv4 }        from "uuid";
import { bus }                  from "../../infrastructure/events/bus.ts";
import { runtimeManager }       from "../../infrastructure/runtime/runtime-manager.ts";
import type { BrowserSession }  from "../types.ts";

const _sessions = new Map<string, BrowserSession>();

export async function createBrowserSession(
  projectId: number,
  runId:     string,
): Promise<BrowserSession | null> {
  // Detect port from runtime manager
  let port: number | undefined;
  try {
    const procs = runtimeManager.getProcesses(projectId);
    port = procs?.find(p => p.port)?.port;
  } catch { /* runtime manager may be unavailable */ }

  if (!port) {
    console.warn("[browser-session] No port detected for project", projectId);
    return null;
  }

  const session: BrowserSession = {
    sessionId: uuidv4(),
    projectId,
    port,
    url:       `http://localhost:${port}/`,
    startedAt: Date.now(),
  };

  _sessions.set(session.sessionId, session);

  bus.emit("agent.event", {
    runId,
    eventType: "browser.session.created" as any,
    phase:     "verify",
    ts:        Date.now(),
    payload:   { sessionId: session.sessionId, port },
  });

  return session;
}

export function getSession(sessionId: string): BrowserSession | undefined {
  return _sessions.get(sessionId);
}

export function closeSession(sessionId: string, runId: string): void {
  _sessions.delete(sessionId);
  bus.emit("agent.event", {
    runId,
    eventType: "browser.session.closed" as any,
    phase:     "verify",
    ts:        Date.now(),
    payload:   { sessionId },
  });
}

export function activeSessionCount(): number {
  return _sessions.size;
}
