/**
 * reducers/aggregation-window.ts
 *
 * Fixed-count and time-based windowing for streaming path events.
 * Windows allow incremental processing without holding the entire event log.
 * Pure data management — no side effects, no I/O.
 */

import type { StreamingPathEvent, ReducerWindow, StreamingSessionId } from "../contracts/aggregation.types.ts";

// ── Window store ──────────────────────────────────────────────────────────────

const _windows = new Map<string, ReducerWindow>();

// ── ID builder ────────────────────────────────────────────────────────────────

function windowKey(sessionId: StreamingSessionId, windowId: string): string {
  return `${sessionId}:${windowId}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function openWindow(
  sessionId: StreamingSessionId,
  windowId:  string,
  maxEvents: number,
): ReducerWindow {
  const w: ReducerWindow = {
    windowId,
    sessionId,
    maxEvents,
    events:   [],
    openedAt: Date.now(),
  };
  _windows.set(windowKey(sessionId, windowId), w);
  return w;
}

export function pushToWindow(
  sessionId: StreamingSessionId,
  windowId:  string,
  event:     StreamingPathEvent,
): { overflow: boolean } {
  const w = _windows.get(windowKey(sessionId, windowId));
  if (!w || w.closedAt !== undefined) return { overflow: false };

  w.events.push(event);

  if (w.events.length >= w.maxEvents) {
    w.closedAt = Date.now();
    return { overflow: true };
  }
  return { overflow: false };
}

export function closeWindow(
  sessionId: StreamingSessionId,
  windowId:  string,
): ReducerWindow | undefined {
  const key = windowKey(sessionId, windowId);
  const w   = _windows.get(key);
  if (!w) return undefined;
  w.closedAt = w.closedAt ?? Date.now();
  return w;
}

export function getWindow(
  sessionId: StreamingSessionId,
  windowId:  string,
): ReducerWindow | undefined {
  return _windows.get(windowKey(sessionId, windowId));
}

export function drainWindow(
  sessionId: StreamingSessionId,
  windowId:  string,
): StreamingPathEvent[] {
  const w = _windows.get(windowKey(sessionId, windowId));
  if (!w) return [];
  const events = [...w.events];
  w.events = [];
  return events;
}

export function clearAllWindows(sessionId: StreamingSessionId): void {
  for (const key of _windows.keys()) {
    if (key.startsWith(`${sessionId}:`)) _windows.delete(key);
  }
}

// ── Age check ─────────────────────────────────────────────────────────────────

export function isWindowStale(window: ReducerWindow, maxAgeMs: number): boolean {
  return Date.now() - window.openedAt > maxAgeMs;
}
