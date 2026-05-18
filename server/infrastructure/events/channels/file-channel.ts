/**
 * file-channel.ts — filter for "file" SSE topic.
 *
 * Matches bus "file.change" events against a connection's projectId.
 * Upstream deduplication is already applied by file-change-emitter.ts
 * (80ms debounce per path+type), so no additional throttle is needed here.
 */

import type { FileChangeEvent } from "../types/event.types.ts";
import type { PooledConnection } from "../types/connection.types.ts";

/**
 * Returns true if this file-change event should be delivered to the connection.
 */
export function matchesFile(conn: PooledConnection, event: FileChangeEvent): boolean {
  if (conn.projectId !== null && event.projectId !== conn.projectId) return false;
  return true;
}
