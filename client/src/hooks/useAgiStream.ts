/**
 * useAgiStream — consume agent + lifecycle events.
 *
 * Console removed: the analytics page only needs agent/lifecycle events.
 * Console logs are already aggregated in AppStateContext.consoleOutput —
 * subscribing here was a duplicate listener causing extra re-renders.
 */

import { useState } from "react";
import { useRealtimeEvent } from "@/realtime/useRealtimeStream";

export function useAgiStream(): unknown[] {
  const [events, setEvents] = useState<unknown[]>([]);

  const push = (data: unknown) =>
    setEvents((prev) => [...prev.slice(-199), data]);

  useRealtimeEvent("agent",     push);
  useRealtimeEvent("lifecycle", push);

  return events;
}
