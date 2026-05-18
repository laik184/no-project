/**
 * preview-lifecycle-channel.ts — filter for "preview.lifecycle" topic.
 *
 * Delivers lifecycle events only to connections that subscribe to this
 * project (or wildcard connections with projectId === null).
 */

import type { PreviewLifecycleEvent } from "../../../preview/lifecycle/preview-lifecycle.types.ts";
import type { PooledConnection } from "../types/connection.types.ts";

export function matchesPreviewLifecycle(
  conn:  PooledConnection,
  event: PreviewLifecycleEvent,
): boolean {
  if (conn.projectId !== null && event.projectId !== conn.projectId) return false;
  return true;
}
