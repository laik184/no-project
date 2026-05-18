/**
 * useIframeAutoRefresh.ts — triggers iframe reload on lifecycle transitions.
 *
 * Watches for transitions into "refreshing" or "ready" (from a non-ready state)
 * and bumps the iframeKey so the IframeView remounts cleanly.
 *
 * No polling — purely event-driven via the lifecycle hook.
 */

import { useCallback, useEffect, useRef } from "react";
import type { PreviewLifecycleState } from "./preview-lifecycle-types";

interface Options {
  state:       PreviewLifecycleState;
  prevState:   PreviewLifecycleState;
  setIframeKey: React.Dispatch<React.SetStateAction<number>>;
  /** Delay before bumping the key to let the server finish binding. */
  delayMs?: number;
}

export function useIframeAutoRefresh({
  state, prevState, setIframeKey, delayMs = 800,
}: Options) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bump = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIframeKey(k => k + 1);
    }, delayMs);
  }, [setIframeKey, delayMs]);

  useEffect(() => {
    // Refresh on → refreshing
    if (state === "refreshing") { bump(); return; }

    // Hard refresh on → ready from starting / restarting / crashed
    if (
      state === "ready" &&
      (prevState === "starting" || prevState === "restarting" ||
       prevState === "crashed"  || prevState === "reconnecting")
    ) {
      bump();
    }
  }, [state, prevState, bump]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);
}
