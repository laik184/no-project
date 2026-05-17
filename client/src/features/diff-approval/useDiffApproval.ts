/**
 * useDiffApproval
 *
 * Subscribes to the unified realtime stream (diff topic) and maintains a
 * queue of pending diff approvals.  Exposes approve() and reject() that call
 * the REST API.
 *
 * Migrated from a standalone EventSource to the shared RealtimeProvider —
 * no longer opens its own connection.
 *
 * Return shape (unchanged from original):
 *   { current, queue, approve, reject, loading, secondsLeft }
 */

import { useState, useCallback, useEffect } from "react";
import type { DiffEvent, ApprovalStatus } from "./diff.types";
import { useRealtimeEvent } from "@/realtime/useRealtimeStream";

export function useDiffApproval(projectId?: number) {
  const [queue,   setQueue]   = useState<DiffEvent[]>([]);
  const [current, setCurrent] = useState<DiffEvent | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  // ── Countdown for the current pending diff ─────────────────────────────────
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!current || current.status !== "pending" || !current.expiresAt) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.round((current.expiresAt! - Date.now()) / 1000));
      setSecondsLeft(left);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [current]);

  // ── Subscribe to diff events via the shared provider ──────────────────────
  useRealtimeEvent("diff", (data) => {
    try {
      const event = data as DiffEvent;
      if (projectId !== undefined && event.projectId !== projectId) return;

      setQueue((prev) => {
        const existingIdx = prev.findIndex((d) => d.sessionId === event.sessionId);

        if (existingIdx !== -1) {
          // Update existing entry
          const next = [...prev];
          next[existingIdx] = event;
          const firstPending = next.find((d) => d.status === "pending") ?? null;
          setCurrent(firstPending);
          if (loading === event.sessionId && event.status !== "pending") setLoading(null);
          return next;
        }

        // New event — only enqueue if pending
        if (event.status !== "pending") return prev;
        const next = [...prev, event];
        setCurrent((c) => c ?? event);
        return next;
      });
    } catch { /* malformed event */ }
  });

  // ── Actions ────────────────────────────────────────────────────────────────
  const approve = useCallback(async (sessionId: string) => {
    setLoading(sessionId);
    try {
      const res = await fetch(`/api/approvals/${sessionId}/approve`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      console.error("[diff-approval] approve failed:", e);
    } finally {
      setLoading(null);
    }
  }, []);

  const reject = useCallback(async (sessionId: string) => {
    setLoading(sessionId);
    try {
      const res = await fetch(`/api/approvals/${sessionId}/reject`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      console.error("[diff-approval] reject failed:", e);
    } finally {
      setLoading(null);
    }
  }, []);

  return { current, queue, approve, reject, loading, secondsLeft };
}
