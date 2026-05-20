/**
 * runtime-channel.ts — filters for "runtime.verified" and "runtime.observation" topics.
 *
 * runtime.verified: emitted once per health-check cycle — low frequency, no throttle.
 * runtime.observation: emitted on each observation poll tick — can be frequent
 *   (default 5s interval × N projects). Throttle to 2s per connection to avoid
 *   flooding clients monitoring many projects.
 */

import type { RuntimeVerifiedEvent, RuntimeObservationEvent, RuntimeSyncEvent } from "../types/event.types.ts";
import type { PooledConnection } from "../types/connection.types.ts";
import { OBSERVATION_THROTTLE_MS } from "../sse/connection-pool.ts";

/**
 * Returns true if this runtime.verified event should be delivered to the connection.
 */
export function matchesRuntimeVerified(
  conn:  PooledConnection,
  event: RuntimeVerifiedEvent,
): boolean {
  if (conn.projectId !== null && event.projectId !== conn.projectId) return false;
  return true;
}

/**
 * Returns true if this runtime.observation event should be delivered to the connection.
 * Throttle interval is applied separately in pool.fanOut.
 */
export function matchesRuntimeObservation(
  conn:  PooledConnection,
  event: RuntimeObservationEvent,
): boolean {
  if (conn.projectId !== null && event.projectId !== conn.projectId) return false;
  return true;
}

/**
 * Returns true if this runtime.sync event should be delivered to the connection.
 * No throttle — transitions are low-frequency and always meaningful.
 */
export function matchesRuntimeSync(
  conn:  PooledConnection,
  event: RuntimeSyncEvent,
): boolean {
  if (conn.projectId !== null && event.projectId !== conn.projectId) return false;
  return true;
}

/** Throttle for runtime.observation fan-out. */
export { OBSERVATION_THROTTLE_MS as OBSERVATION_THROTTLE };
