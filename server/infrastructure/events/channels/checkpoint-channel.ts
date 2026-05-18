/**
 * checkpoint-channel.ts — filter for "checkpoint" SSE topic.
 *
 * Matches bus "checkpoint.event" events against a connection's
 * projectId and runId filters. No throttle — checkpoint events are
 * critical lifecycle signals (creating/stable/failed/rollback).
 */

import type { CheckpointEvent } from "../types/event.types.ts";
import type { PooledConnection } from "../types/connection.types.ts";

/**
 * Returns true if this checkpoint event should be delivered to the connection.
 */
export function matchesCheckpoint(conn: PooledConnection, event: CheckpointEvent): boolean {
  if (conn.runId !== undefined && event.runId && event.runId !== conn.runId) return false;
  if (conn.projectId !== null && event.projectId !== conn.projectId) return false;
  return true;
}
