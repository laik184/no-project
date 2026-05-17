/**
 * useDiffApproval
 *
 * Subscribes to the unified realtime stream (diff topic) and maintains a
 * queue of pending diff approvals.  Exposes approve() and reject() that call
 * the REST API.
 *
 * Migrated from a standalone EventSource to the shared RealtimeProvider —
 * no longer opens its own connection.
 */

import { useState, useCallback } from "react";
import type { DiffEvent, ApprovalStatus } from "./diff.types";
import { useRealtimeEvent } from "@/realtime/useRealtimeStream";

export interface DiffApprovalState {
  queue:    DiffEvent[];
  current:  DiffEvent | null;
  loading:  string | null;
}

export function useDiffApproval(projectId?: number) {
  const [state, setState] = useState<DiffApprovalState>({
    queue:   [],
    current: null,
    loading: null,
  });

  useRealtimeEvent("diff", (data) => {
    try {
      const event = data as DiffEvent;
      if (projectId !== undefined && event.projectId !== projectId) return;

      setState((prev) => {
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
            loading:
              prev.loading === event.sessionId && event.status !== "pending"
                ? null
                : prev.loading,
          };
        }
        if (event.status !== "pending") return prev;
        const next = [...prev.queue, event];
        return { queue: next, current: prev.current ?? event, loading: prev.loading };
      });
    } catch { /* malformed event */ }
  });

  const approve = useCallback(async (sessionId: string) => {
    setState((p) => ({ ...p, loading: sessionId }));
    try {
      const res = await fetch(`/api/approvals/${sessionId}/approve`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      console.error("[diff-approval] approve failed:", e);
    } finally {
      setState((p) => ({ ...p, loading: null }));
    }
  }, []);

  const reject = useCallback(async (sessionId: string) => {
    setState((p) => ({ ...p, loading: sessionId }));
    try {
      const res = await fetch(`/api/approvals/${sessionId}/reject`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      console.error("[diff-approval] reject failed:", e);
    } finally {
      setState((p) => ({ ...p, loading: null }));
    }
  }, []);

  return { state, approve, reject };
}
