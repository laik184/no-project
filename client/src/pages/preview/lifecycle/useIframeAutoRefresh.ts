/**
 * useIframeAutoRefresh.ts — triggers iframe reload on lifecycle transitions.
 *
 * v2: Smart reload logic:
 *   - hot_reloading → NO iframe reload (CSS injected in-place)
 *   - verifying     → NO reload (server just starting)
 *   - refreshing    → soft reload (bump key)
 *   - ready (from starting/restarting/crashed/patching) → hard reload
 *   - ready (from hot_reloading) → NO reload (CSS already applied)
 *
 * No polling — purely event-driven via the lifecycle hook.
 */

import { useCallback, useEffect, useRef } from "react";
import type { PreviewLifecycleState } from "./preview-lifecycle-types";

interface Options {
  state:        PreviewLifecycleState;
  prevState:    PreviewLifecycleState;
  setIframeKey: React.Dispatch<React.SetStateAction<number>>;
  delayMs?:     number;
}

// States that require a full iframe reload when transitioning into "ready".
// "verifying" is the normal penultimate state before "ready" — must be included
// so the iframe reloads after a standard startup: idle→starting→verifying→ready.
const HARD_RELOAD_PREV = new Set<PreviewLifecycleState>([
  "starting", "verifying", "restarting", "crashed", "patching", "reconnecting",
]);

// States where we NEVER reload the iframe
const NO_RELOAD_STATES = new Set<PreviewLifecycleState>([
  "hot_reloading", "verifying", "debugging", "self_healing",
]);

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
    // Never reload for no-reload states
    if (NO_RELOAD_STATES.has(state)) return;

    // Soft reload on → refreshing
    if (state === "refreshing") { bump(); return; }

    // Hard reload on → ready, BUT only from meaningful prev states
    // Skip reload if we just came from hot_reloading (CSS was already applied)
    if (state === "ready") {
      if (prevState === "hot_reloading") return;
      if (HARD_RELOAD_PREV.has(prevState)) {
        bump();
      }
    }
  }, [state, prevState, bump]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);
}
