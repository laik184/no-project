/**
 * agent-channel.ts — filter for "agent" SSE topic.
 *
 * Matches bus "agent.event" events against a pooled connection's
 * projectId and runId filters. No throttling — agent events are
 * sparse and user-visible; dropping them degrades UX.
 */

import type { AgentEvent } from "../types/event.types.ts";
import type { PooledConnection } from "../types/connection.types.ts";

/**
 * Returns true if this agent event should be delivered to the connection.
 */
export function matchesAgent(conn: PooledConnection, event: AgentEvent): boolean {
  if (conn.runId !== undefined && event.runId !== conn.runId) return false;
  if (
    conn.projectId !== null &&
    event.projectId !== undefined &&
    event.projectId !== conn.projectId
  ) return false;
  return true;
}
