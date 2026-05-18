/**
 * console-channel.ts — filter for "console" SSE topic.
 *
 * Console output (stdout/stderr from sandboxed processes) is the highest-
 * frequency event in the system. Without throttling, a process that writes
 * rapidly (e.g. a build tool) can saturate SSE connections and dominate
 * the event loop.
 *
 * Throttle strategy: per-connection, 50ms minimum between deliveries
 * (≤ 20 console events/sec per client). The DB persister (console-log-persister.ts)
 * receives ALL events unthrottled — only SSE fan-out is rate-limited.
 */

import type { ConsoleLogEvent } from "../types/event.types.ts";
import type { PooledConnection } from "../types/connection.types.ts";
import { CONSOLE_THROTTLE_MS } from "../sse/connection-pool.ts";

/**
 * Returns true if this console event should be delivered to the connection.
 * Applies projectId filter + per-connection rate limit.
 *
 * NOTE: The throttle side-effect (updating topicThrottle) happens inside
 * pool.fanOut via isThrottled() — this filter only handles scoping.
 */
export function matchesConsole(conn: PooledConnection, event: ConsoleLogEvent): boolean {
  if (conn.projectId !== null && event.projectId !== conn.projectId) return false;
  return true;
}

/** Throttle interval exported so pool.fanOut can apply it for this topic. */
export { CONSOLE_THROTTLE_MS as THROTTLE_MS };
