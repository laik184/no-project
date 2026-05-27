/**
 * browser-session-channel.ts — filter for "browser.session" SSE topic.
 *
 * Broadcasts to all connections (projectId === null means global).
 * When a projectId is scoped, only deliver to matching connections.
 */

import type { BrowserSessionEvent } from "../types/browser-event.types.ts";
import type { PooledConnection }    from "../types/connection.types.ts";

export function matchesBrowserSession(
  conn:  PooledConnection,
  event: BrowserSessionEvent,
): boolean {
  if (conn.projectId === null) return true;
  if (event.projectId === undefined) return true;
  return conn.projectId === event.projectId;
}
