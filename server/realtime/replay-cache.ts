/**
 * replay-cache.ts — server-side SSE event replay buffer
 *
 * Assigns a monotonic sequence ID to every outgoing SSE event and keeps the
 * last MAX_EVENTS in a ring buffer.  When a client reconnects with a
 * Last-Event-ID (or ?lastEventId= query param), replay() returns every event
 * whose seqId is greater than the client's last-seen ID.
 *
 * Design constraints:
 *  - Zero external dependencies — plain in-memory ring buffer
 *  - Thread-safe for Node.js single-threaded event loop
 *  - O(1) record, O(n) replay (n = missed events, typically small)
 *  - Capped at MAX_EVENTS to bound memory usage
 */

const MAX_EVENTS = 500;

interface CachedEvent {
  seqId: number;
  topic: string;
  data:  unknown;
  ts:    number;
}

let seq = 0;
const cache: CachedEvent[] = [];

/**
 * Record an outgoing SSE event and return its monotonic sequence ID.
 * Call this BEFORE writing to the response so the ID is available for the frame.
 */
export function record(topic: string, data: unknown): number {
  const seqId = ++seq;
  cache.push({ seqId, topic, data, ts: Date.now() });
  if (cache.length > MAX_EVENTS) cache.shift();
  return seqId;
}

/**
 * Return all cached events whose seqId is strictly greater than `lastSeqId`.
 * Optionally filter to only the requested topics.
 */
export function replay(
  lastSeqId: number,
  topicFilter?: ReadonlySet<string>,
): CachedEvent[] {
  return cache.filter(
    (e) =>
      e.seqId > lastSeqId &&
      (topicFilter === undefined || topicFilter.has(e.topic)),
  );
}

/** Current highest assigned sequence ID (useful for diagnostics). */
export function currentSeq(): number {
  return seq;
}
