/**
 * usePreviewLifecycle.ts — subscribes to preview.lifecycle SSE events.
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

  // When SSE reconnects, show reconnecting state in UI
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
