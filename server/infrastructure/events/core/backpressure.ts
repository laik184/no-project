/**
 * backpressure.ts — TCP backpressure-aware SSE write primitive.
 *
 * When a client's TCP write buffer is full, res.write() returns false.
 * Continuing to write into a backpressured connection wastes CPU, causes
 * event-loop blocking, and can corrupt SSE frames if writes interleave.
 *
 * Strategy: SKIP — drop events for backpressured connections and resume
 * as soon as the socket drains. This keeps the event loop unblocked and
 * naturally drops stale data for slow clients instead of buffering it.
 *
 * Usage:
 *   safeWrite(conn, "agent", data, seqId);
 */

import type { PooledConnection } from "../types/connection.types.ts";
import { sseSendId } from "../../../chat/streams/sse-utils.ts";

/**
 * Write one SSE event frame to a pooled connection.
 *
 * Silently drops the write if:
 *   - conn.backpressured is true (socket buffer full, waiting for drain)
 *   - conn.res.writableEnded is true (connection already closed)
 *
 * When res.write() returns false, sets conn.backpressured = true and
 * registers a one-shot 'drain' listener that clears the flag.
 */
export function safeWrite(
  conn:   PooledConnection,
  topic:  string,
  data:   unknown,
  seqId:  number,
): void {
  if (conn.backpressured)       return;
  if (conn.res.writableEnded)   return;

  try {
    sseSendId(conn.res, topic, data, seqId);
    conn.lastWriteAt = Date.now();
    // writableNeedsDrain is true when the last write filled the TCP buffer
    if ((conn.res as any).writableNeedsDrain) {
      conn.backpressured = true;
      conn.res.once("drain", () => { conn.backpressured = false; });
    }
  } catch {
    return;
  }
}

/**
 * Throttle guard for high-frequency topics (e.g. console.log).
 *
 * Returns true if the event should be delivered to this connection,
 * false if it should be dropped due to rate limiting.
 * Updates conn.topicThrottle[topic] on pass.
 *
 * @param conn          Pooled connection
 * @param topic         SSE topic key
 * @param minIntervalMs Minimum ms between writes for this topic per connection.
 *                      0 = no throttle.
 */
export function isThrottled(
  conn:          PooledConnection,
  topic:         string,
  minIntervalMs: number,
): boolean {
  if (minIntervalMs <= 0) return false;
  const now  = Date.now();
  const last = conn.topicThrottle.get(topic) ?? 0;
  if (now - last < minIntervalMs) return true;
  conn.topicThrottle.set(topic, now);
  return false;
}
