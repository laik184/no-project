/**
 * lifecycle-channel.ts — filter for "lifecycle" SSE topic.
 *
 * Matches bus "run.lifecycle" events against a connection's
 * projectId and runId filters. No throttling — lifecycle transitions
 * (started/completed/failed/cancelled) are critical low-frequency signals.
 */

import type { RunLifecycleEvent } from "../types/event.types.ts";
import type { PooledConnection } from "../types/connection.types.ts";

/**
 * Returns true if this lifecycle event should be delivered to the connection.
 */
export function matchesLifecycle(conn: PooledConnection, event: RunLifecycleEvent): boolean {
  if (conn.runId !== undefined && event.runId !== conn.runId) return false;
  if (conn.projectId !== null && event.projectId !== conn.projectId) return false;
  return true;
}
