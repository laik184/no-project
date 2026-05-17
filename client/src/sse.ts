/**
 * connectSSE — global event firehose connection helper.
 *
 * Fixed: was using es.onmessage which never fires for named events.
 * /events sends everything under `event: event` — must use addEventListener.
 *
 * Returns a cleanup function to close the connection.
 */

import { openSSE } from "@/realtime/sse-utils";

export function connectSSE(onEvent: (data: unknown) => void): () => void {
  return openSSE("/api/realtime", {
    agent:                 onEvent,
    lifecycle:             onEvent,
    console:               onEvent,
    file:                  onEvent,
    "runtime.verified":    onEvent,
    "runtime.observation": onEvent,
    diff:                  onEvent,
    checkpoint:            onEvent,
  });
}
