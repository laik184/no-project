/**
 * realtime-provider.tsx — singleton SSE connection for the whole app.
 *
 * ONE EventSource to /api/realtime — replaces the 15+ scattered
 * EventSource connections that previously opened independently.
 *
 * Usage:
 *   <RealtimeProvider>…</RealtimeProvider>           (wrap app root)
 *   const { subscribe } = useRealtime();             (inside any component)
 *   const off = subscribe("console", handler);       (returns unsubscribe fn)
 *
 * Rules:
 *  - One connection per mounted provider instance.
 *  - Exponential-backoff reconnect on error (1s → 30s cap).
 *  - Handlers stored in a ref map — adding/removing never reconnects.
 *  - All cleanup is guaranteed on unmount or connection close.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { ALL_TOPICS, type RealtimeTopic } from "./realtime-events";

// ── Types ─────────────────────────────────────────────────────────────────────

type Handler = (data: unknown) => void;
type Unsubscribe = () => void;

export interface RealtimeContextValue {
  /**
   * Subscribe to a topic.  Returns an unsubscribe function — always call it
   * in the cleanup phase of your useEffect / component unmount.
   */
  subscribe: (topic: string, handler: Handler) => Unsubscribe;
}

// ── Context ───────────────────────────────────────────────────────────────────

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

interface RealtimeProviderProps {
  children: ReactNode;
}

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  // Map<topic, Set<handler>> — never replaced, only mutated.
  const handlersRef = useRef<Map<string, Set<Handler>>>(new Map());

  // Stable subscribe — safe to pass as a prop or store in a ref.
  const subscribe = useCallback((topic: string, handler: Handler): Unsubscribe => {
    const map = handlersRef.current;
    if (!map.has(topic)) map.set(topic, new Set());
    map.get(topic)!.add(handler);
    return () => { map.get(topic)?.delete(handler); };
  }, []);

  // Single EventSource lifecycle.
  useEffect(() => {
    let es: EventSource | null = null;
    let mounted = true;
    let backoff = 1_000;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    // Per-topic dispatcher — closed over handlersRef so handler additions
    // after connect() are picked up without reconnecting.
    const dispatch = (topic: string) => (ev: Event) => {
      const msg = ev as MessageEvent;
      const set = handlersRef.current.get(topic);
      if (!set || set.size === 0) return;
      try {
        const data = JSON.parse(msg.data);
        set.forEach((h) => { try { h(data); } catch {} });
      } catch {
        set.forEach((h) => { try { h(msg.data); } catch {} });
      }
    };

    const connect = () => {
      if (!mounted) return;

      es = new EventSource("/api/realtime");

      // Attach one listener per canonical topic.
      for (const topic of ALL_TOPICS) {
        es.addEventListener(topic as string, dispatch(topic));
      }

      es.onopen = () => { backoff = 1_000; };

      es.onerror = () => {
        try { es?.close(); } catch {}
        es = null;
        if (mounted) {
          backoff = Math.min(30_000, backoff * 2);
          retryTimer = setTimeout(connect, backoff);
        }
      };
    };

    connect();

    return () => {
      mounted = false;
      if (retryTimer) clearTimeout(retryTimer);
      try { es?.close(); } catch {}
    };
  }, []); // mount once — no reconnect on prop change needed

  return (
    <RealtimeContext.Provider value={{ subscribe }}>
      {children}
    </RealtimeContext.Provider>
  );
}

// ── Consumer hook ─────────────────────────────────────────────────────────────

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime must be used within <RealtimeProvider>");
  return ctx;
}
