/**
 * useDiffApproval
 *
 * Subscribes to /sse/diffs and maintains a queue of pending diff approvals.
 * Exposes approve() and reject() that call the REST API.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { DiffEvent, ApprovalStatus } from "./diff.types";

export interface DiffApprovalState {
  queue:    DiffEvent[];
  current:  DiffEvent | null;
  loading:  string | null; // sessionId being processed
}

export function useDiffApproval(projectId?: number) {
  const [state, setState] = useState<DiffApprovalState>({
    queue:   [],
    current: null,
    loading: null,
  });
  const esRef = useRef<EventSource | null>(null);

  // ── SSE subscription ───────────────────────────────────────────────────────
  useEffect(() => {
    const url = projectId
      ? `/sse/diffs?projectId=${projectId}`
      : "/sse/diffs";

    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("diff", (e: MessageEvent) => {
      try {
        const event: DiffEvent = JSON.parse(e.data);
        setState((prev) => {
          // Update existing entry if it's a status change
          const existingIdx = prev.queue.findIndex(
            (d) => d.sessionId === event.sessionId,
          );
          if (existingIdx !== -1) {
            const next = [...prev.queue];
            next[existingIdx] = event;
            const pending = next.filter((d) => d.status === "pending");
            return {
              queue:   next,
              current: pending[0] ?? null,
              loading: prev.loading === event.sessionId && event.status !== "pending"
                ? null
                : prev.loading,
            };
          }
          // New pending diff
          if (event.status !== "pending") return prev;
          const next = [...prev.queue, event];
          return {
            queue:   next,
            current: prev.current ?? event,
            loading: prev.loading,
          };
        });
      } catch { /* malformed event */ }
    });

    es.onerror = () => {
      // Reconnect handled automatically by EventSource
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [projectId]);

  // ── Approve ────────────────────────────────────────────────────────────────
  const approve = useCallback(async (sessionId: string) => {
    setState((p) => ({ ...p, loading: sessionId }));
    try {
      const res = await fetch(`/api/approvals/${sessionId}/approve`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("[diff-approval] approve failed:", body.error);
      }
    } finally {
      setState((p) => {
        const next = p.queue.filter((d) => d.sessionId !== sessionId);
        const pending = next.filter((d) => d.status === "pending");
        return { queue: next, current: pending[0] ?? null, loading: null };
      });
    }
  }, []);

  // ── Reject ─────────────────────────────────────────────────────────────────
  const reject = useCallback(async (sessionId: string) => {
    setState((p) => ({ ...p, loading: sessionId }));
    try {
      const res = await fetch(`/api/approvals/${sessionId}/reject`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("[diff-approval] reject failed:", body.error);
      }
    } finally {
      setState((p) => {
        const next = p.queue.filter((d) => d.sessionId !== sessionId);
        const pending = next.filter((d) => d.status === "pending");
        return { queue: next, current: pending[0] ?? null, loading: null };
      });
    }
  }, []);

  // ── Countdown ──────────────────────────────────────────────────────────────
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!state.current) { setSecondsLeft(null); return; }
    const tick = () => {
      const left = Math.max(0, Math.round((state.current!.expiresAt - Date.now()) / 1000));
      setSecondsLeft(left);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [state.current]);

  return { ...state, approve, reject, secondsLeft };
}
