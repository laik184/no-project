/**
 * useAgentUltraStream — collect agent + lifecycle events for a specific runId.
 *
 * Migrated to unified RealtimeProvider.  Filters by runId client-side so
 * the shared connection is reused.
 */

import { useState } from "react";
import { useRealtimeEvent } from "@/realtime/useRealtimeStream";

export function useAgentUltraStream(runId?: string): unknown[] {
  const [events, setEvents] = useState<unknown[]>([]);

  useRealtimeEvent("agent", (data) => {
    const e = data as { runId?: string };
    if (runId && e.runId !== runId) return;
    setEvents((prev) => [...prev, data]);
  });

  useRealtimeEvent("lifecycle", (data) => {
    const e = data as { runId?: string };
    if (runId && e.runId !== runId) return;
    setEvents((prev) => [...prev, data]);
  });

  return events;
}
