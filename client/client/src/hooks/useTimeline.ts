import { useEffect, useState } from "react";

export interface TimelineEvent {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

export function useTimeline() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchTimeline() {
      try {
        const res = await fetch("/api/timeline");
        if (!res.ok) throw new Error("Failed to load timeline");
        const data = await res.json();
        if (active) setEvents(data.events || data || []);
      } catch (e: any) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchTimeline();
    const t = setInterval(fetchTimeline, 3000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  return { events, loading, error };
}