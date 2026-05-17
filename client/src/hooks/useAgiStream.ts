/**
 * useAgiStream — consume agent + lifecycle + console events.
 *
 * Migrated to unified RealtimeProvider — no longer opens its own
 * EventSource connection.  Collects all three topic streams into one array.
 */

import { useState } from "react";
import { useRealtimeEvent } from "@/realtime/useRealtimeStream";

export function useAgiStream(): unknown[] {
  const [events, setEvents] = useState<unknown[]>([]);

  const push = (data: unknown) =>
    setEvents((prev) => [...prev.slice(-199), data]);

  useRealtimeEvent("agent",     push);
  useRealtimeEvent("lifecycle", push);
  useRealtimeEvent("console",   push);

  return events;
}
