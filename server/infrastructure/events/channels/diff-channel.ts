/**
 * diff-channel.ts — filter for "diff" SSE topic.
 *
 * Matches bus "agent.diff" events against a connection's projectId.
 * Diff events are critical UI triggers (show approval modal) — no throttle.
 */

import type { AgentDiffEvent } from "../types/event.types.ts";
import type { PooledConnection } from "../types/connection.types.ts";

/**
 * Returns true if this diff event should be delivered to the connection.
 */
export function matchesDiff(conn: PooledConnection, event: AgentDiffEvent): boolean {
  if (conn.projectId !== null && event.projectId !== conn.projectId) return false;
  return true;
}
