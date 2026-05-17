/**
 * useRealtimeStream.ts — hooks for consuming the unified realtime stream.
 *
 * Two patterns are available:
 *
 *  1. useRealtimeEvent(topic, handler, enabled?)
 *     Fire-and-forget callback — handler is called on every event.
 *     Use when you process events imperatively (updating refs, imperative DOM).
 *
 *  2. useRealtimeTopic(topic, maxEvents?)
 *     Stateful collector — returns a growing array of recent events.
 *     Use when you render a list of events or need reactive re-renders.
 *
 * Both hooks:
 *  - Automatically subscribe on mount and unsubscribe on unmount.
 *  - Accept a changing handler without reconnecting (latest-ref pattern).
 *  - Do nothing when `enabled` is false (default: true).
 */

import { useEffect, useRef, useState } from "react";
import { useRealtime } from "./realtime-provider";

// ── useRealtimeEvent ──────────────────────────────────────────────────────────

/**
 * Call `handler` every time a `topic` event arrives.
 *
 * @param topic    SSE event name (e.g. "console", "agent", "file").
 * @param handler  Callback — identity may change each render; the hook uses a
 *                 ref internally so the latest version is always called without
 *                 reconnecting the stream.
 * @param enabled  Set to false to pause the subscription (default: true).
 */
export function useRealtimeEvent(
  topic: string,
  handler: (data: unknown) => void,
  enabled = true,
): void {
  const { subscribe } = useRealtime();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;
    return subscribe(topic, (data) => { handlerRef.current(data); });
  }, [topic, enabled, subscribe]);
}

// ── useRealtimeTopic ──────────────────────────────────────────────────────────

/**
 * Collect incoming events for `topic` into a stateful array.
 *
 * @param topic      SSE event name.
 * @param maxEvents  Rolling window size (default: 200).
 * @returns          Array of raw event payloads (newest last).
 */
export function useRealtimeTopic(topic: string, maxEvents = 200): unknown[] {
  const [events, setEvents] = useState<unknown[]>([]);

  useRealtimeEvent(topic, (data) => {
    setEvents((prev) => [...prev.slice(-(maxEvents - 1)), data]);
  });

  return events;
}
