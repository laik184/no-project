/**
 * usePreviewLifecycle.ts — subscribes to preview.lifecycle SSE events.
 *
 * On mount it fetches the current state from the server so the UI starts
 * in the right state (idle vs ready) without waiting for the next event.
 *
 * Returns the current lifecycle state + last message so any component
 * can render appropriate UI without polling.
 *
 * The hook is safe to mount multiple times — all instances share the
 * same underlying RealtimeProvider EventSource connection.
 */

import { useEffect, useRef, useState } from "react";
import { useRealtime } from "@/realtime/realtime-provider";
import { TOPIC } from "@/realtime/realtime-events";
import type { PreviewLifecycleState } from "./preview-lifecycle-types";

export interface LifecycleSnapshot {
  state:     PreviewLifecycleState;
  prevState: PreviewLifecycleState;
  message:   string;
  meta?:     Record<string, unknown>;
  ts:        number;
}

interface UsePreviewLifecycleOptions {
  projectId?: number;
  onStateChange?: (snapshot: LifecycleSnapshot) => void;
}

const INITIAL: LifecycleSnapshot = {
  state:     "idle",
  prevState: "idle",
  message:   "Ready.",
  ts:        Date.now(),
};

export function usePreviewLifecycle(opts: UsePreviewLifecycleOptions = {}) {
  const { subscribe, status } = useRealtime();
  const [snapshot, setSnapshot]   = useState<LifecycleSnapshot>(INITIAL);
  const onChangeRef = useRef(opts.onStateChange);
  onChangeRef.current = opts.onStateChange;

  // ── Initial state sync — query server on mount ────────────────────────
  useEffect(() => {
    const syncInitial = async () => {
      try {
        // Use the all-projects endpoint when no specific projectId is given.
        const url = opts.projectId != null
          ? `/api/lifecycle-state/${opts.projectId}`
          : "/api/lifecycle-state";

        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();

        if (opts.projectId != null) {
          // Single project response: { state, running, port }
          if (data.ok && data.state) {
            const snap: LifecycleSnapshot = {
              state:     data.state as PreviewLifecycleState,
              prevState: "idle",
              message:   data.running ? `Server running on port ${data.port ?? "?"}.` : "No server running.",
              meta:      { port: data.port },
              ts:        Date.now(),
            };
            setSnapshot(snap);
            onChangeRef.current?.(snap);
          }
        } else {
          // All-projects response: pick the first running/ready entry if any
          if (data.ok && Array.isArray(data.entries) && data.entries.length > 0) {
            const running = data.entries.find(
              (e: { state: string }) => e.state === "ready" || e.state === "starting",
            );
            if (running) {
              const snap: LifecycleSnapshot = {
                state:     running.state as PreviewLifecycleState,
                prevState: "idle",
                message:   `Server running on port ${running.port ?? "?"}.`,
                meta:      { port: running.port, projectId: running.projectId },
                ts:        Date.now(),
              };
              setSnapshot(snap);
              onChangeRef.current?.(snap);
            }
          }
        }
      } catch {
        // Network error — stay at idle
      }
    };

    syncInitial();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.projectId]);

  // ── Live SSE subscription ─────────────────────────────────────────────
  useEffect(() => {
    const off = subscribe(TOPIC.PREVIEW_LIFECYCLE, (raw: unknown) => {
      const data = raw as LifecycleSnapshot & { projectId?: number };

      // If a specific projectId is requested, filter by it
      if (opts.projectId != null && data.projectId !== opts.projectId) return;

      const snap: LifecycleSnapshot = {
        state:     data.state     ?? "idle",
        prevState: data.prevState ?? "idle",
        message:   data.message   ?? "",
        meta:      data.meta,
        ts:        data.ts        ?? Date.now(),
      };

      setSnapshot(snap);
      onChangeRef.current?.(snap);
    });

    return off;
  }, [subscribe, opts.projectId]);

  // ── SSE reconnect → show reconnecting state ───────────────────────────
  useEffect(() => {
    if (status === "reconnecting") {
      setSnapshot(prev => ({
        ...prev,
        prevState: prev.state,
        state:     "reconnecting",
        message:   "Reconnecting to server...",
        ts:        Date.now(),
      }));
    }
  }, [status]);

  return { snapshot, connectionStatus: status };
}
