import type { ObservationEvent } from "../types";

export function filterByWindow(events: ObservationEvent[], windowMs: number): ObservationEvent[] {
  const cutoff = Date.now() - windowMs;
  return events.filter((e) => e.timestamp >= cutoff);
}

export function groupByModule(events: ObservationEvent[]): Map<string, ObservationEvent[]> {
  const map = new Map<string, ObservationEvent[]>();
  for (const e of events) {
    const existing = map.get(e.module) ?? [];
    existing.push(e);
    map.set(e.module, existing);
  }
  return map;
}

export function groupByAgent(events: ObservationEvent[]): Map<string, ObservationEvent[]> {
  const map = new Map<string, ObservationEvent[]>();
  for (const e of events) {
    const key = `${e.module}::${e.agent}`;
    const existing = map.get(key) ?? [];
    existing.push(e);
    map.set(key, existing);
  }
  return map;
}

export function sortByTime(events: ObservationEvent[]): ObservationEvent[] {
  return [...events].sort((a, b) => a.timestamp - b.timestamp);
}

export function slidingWindowValues(
  events: ObservationEvent[],
  windowSizeMs: number,
  stepMs: number,
  getValue: (e: ObservationEvent) => number
): number[] {
  if (events.length === 0) return [];
  const sorted = sortByTime(events);
  const start = sorted[0].timestamp;
  const end = sorted[sorted.length - 1].timestamp;
  const results: number[] = [];

  for (let t = start; t <= end; t += stepMs) {
    const windowEvents = sorted.filter(
      (e) => e.timestamp >= t && e.timestamp < t + windowSizeMs
    );
    if (windowEvents.length > 0) {
      const avg = windowEvents.reduce((s, e) => s + getValue(e), 0) / windowEvents.length;
      results.push(Math.round(avg * 100) / 100);
    }
  }
  return results;
}
