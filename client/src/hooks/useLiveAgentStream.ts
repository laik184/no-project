/**
 * useLiveAgentStream — subscribe to agent stream events with typed handlers.
 *
 * Migrated to unified RealtimeProvider.  Handler identity changes no longer
 * cause reconnects — the latest-ref pattern is handled inside useRealtimeEvent.
 */

import { useRealtimeEvent } from "@/realtime/useRealtimeStream";
import type { SSEHandlers } from "@/realtime/sse-utils";

export function useLiveAgentStream(handlers: SSEHandlers): void {
  useRealtimeEvent("agent",      (data) => handlers["agent"]?.(data));
  useRealtimeEvent("lifecycle",  (data) => handlers["lifecycle"]?.(data));
  useRealtimeEvent("checkpoint", (data) => handlers["checkpoint"]?.(data));
}
