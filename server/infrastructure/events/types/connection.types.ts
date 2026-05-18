/**
 * connection.types.ts — SSE connection shape used by the pool and channels.
 *
 * Kept separate from event.types.ts so channel filter modules only need
 * to import the connection shape without pulling in all event interfaces.
 */

import type { Response } from "express";

/**
 * A live SSE connection registered in the ConnectionPool.
 * All fields are set at registration time and mutated only by
 * backpressure.ts (backpressured flag) and the pool (lastWriteAt).
 */
export interface PooledConnection {
  /** Unique connection identifier — monotonic counter. */
  id:            string;
  /** Express response stream for this SSE client. */
  res:           Response;
  /** Topics this client subscribed to (e.g. "agent", "console"). */
  topics:        ReadonlySet<string>;
  /** Project filter — null means receive events for all projects. */
  projectId:     number | null;
  /** Run filter — undefined means receive events for all runs. */
  runId:         string | undefined;
  /** Unix timestamp of connection registration. */
  connectedAt:   number;
  /** Unix timestamp of most recent successful write. */
  lastWriteAt:   number;
  /**
   * True when res.write() returned false (TCP write buffer full).
   * Events are dropped for this connection until the 'drain' event fires.
   * Reset automatically by backpressure.ts via res.once('drain').
   */
  backpressured: boolean;
  /**
   * Per-topic last-write timestamps for rate-limiting high-frequency events.
   * Populated lazily; channel modules write to this map before checking throttle.
   */
  topicThrottle: Map<string, number>;
}
