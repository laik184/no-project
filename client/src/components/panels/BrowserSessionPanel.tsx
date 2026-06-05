/**
 * BrowserSessionPanel.tsx
 * Live status panel for Playwright browser sessions.
 * Shows active sessions, screenshots, validation results, and lifecycle events.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRealtime } from "@/realtime/realtime-provider";
import { TOPIC } from "@/realtime/realtime-events";
import { MonitorPlay, RefreshCw, Wifi, WifiOff } from "lucide-react";
import {
  SessionState, SessionSnapshot, BrowserSessionEvent, SessionsResponse,
} from "./browser-session-types";
import { SessionCard, EmptyState } from "./browser-session-cards";

export function BrowserSessionPanel() {
  const [sessions, setSessions] = useState<Map<string, SessionState>>(new Map());
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const { subscribe, status: realtimeStatus } = useRealtime();
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data, refetch, isLoading } = useQuery<SessionsResponse>({
    queryKey: ["/api/browser/sessions"],
    refetchInterval: 10_000,
  });

  useEffect(() => {
    if (!data?.sessions) return;
    setSessions((prev) => {
      const next = new Map(prev);
      for (const snap of data.sessions) {
        const existing = next.get(snap.sessionId);
        next.set(snap.sessionId, {
          ...(existing ?? {}),
          ...snap,
          screenshots:    existing?.screenshots    ?? [],
          consoleErrors:  existing?.consoleErrors  ?? 0,
          lastValidation: existing?.lastValidation,
          lastUrl:        existing?.lastUrl,
          lastError:      existing?.lastError,
          events:         existing?.events         ?? [],
        });
      }
      return next;
    });
  }, [data]);

  useEffect(() => {
    tickRef.current = setInterval(() => {
      setSessions((s) => new Map(s));
    }, 5_000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  const handleEvent = useCallback((raw: unknown) => {
    const e = raw as BrowserSessionEvent;
    setLastEvent(e.timestamp);

    setSessions((prev) => {
      const next = new Map(prev);
      const existing = next.get(e.sessionId);
      const base: SessionState = existing ?? {
        sessionId:  e.sessionId,
        runId:      e.runId,
        projectId:  e.projectId ?? null,
        status:     "launching",
        pagesOpen:  0,
        launchedAt: e.timestamp,
        closedAt:   null,
        screenshots: [],
        consoleErrors: 0,
        events: [],
      };

      const updated: SessionState = { ...base };
      updated.events = [...base.events, { type: e.type, ts: e.timestamp, label: e.label }].slice(-50);

      switch (e.type) {
        case "started":
          updated.status     = "ready";
          updated.launchedAt = e.timestamp;
          break;
        case "closed":
          updated.status   = "closed";
          updated.closedAt = e.timestamp;
          break;
        case "crashed":
          updated.status    = "crashed";
          updated.closedAt  = e.timestamp;
          updated.lastError = e.error;
          break;
        case "screenshot":
          updated.status = "capturing";
          if (e.screenshotPath) {
            updated.screenshots = [
              ...base.screenshots,
              {
                label: e.label ?? "screenshot",
                path:  e.screenshotPath,
                url:   `/api/browser/screenshot?path=${encodeURIComponent(e.screenshotPath)}`,
                ts:    e.timestamp,
              },
            ].slice(-20);
          }
          break;
        case "validation.passed":
          updated.status         = "ready";
          updated.lastValidation = "passed";
          updated.lastUrl        = e.url;
          break;
        case "validation.failed":
          updated.lastValidation = "failed";
          updated.lastUrl        = e.url;
          updated.lastError      = e.error;
          break;
      }

      next.set(e.sessionId, updated);
      return next;
    });
  }, []);

  useEffect(() => {
    return subscribe(TOPIC.BROWSER_SESSION, handleEvent);
  }, [subscribe, handleEvent]);

  const allSessions = Array.from(sessions.values()).sort((a, b) => {
    const aDead = a.status === "closed" || a.status === "crashed";
    const bDead = b.status === "closed" || b.status === "crashed";
    if (aDead !== bDead) return aDead ? 1 : -1;
    return (b.launchedAt ?? "").localeCompare(a.launchedAt ?? "");
  });

  const activeSessions = allSessions.filter((s) => s.status !== "closed" && s.status !== "crashed");

  return (
    <div className="flex flex-col h-full overflow-hidden" data-testid="panel-browser-sessions">

      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-4 flex-shrink-0"
        style={{ height: 44, borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <MonitorPlay style={{ width: 14, height: 14, color: "#60a5fa" }} />
        <span className="text-[12.5px] font-semibold" style={{ color: "rgba(226,232,240,0.85)" }}>
          Browser Sessions
        </span>

        {activeSessions.length > 0 && (
          <span
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}
            data-testid="status-active-count"
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#34d399", boxShadow: "0 0 6px #34d399" }} />
            {activeSessions.length} active
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {realtimeStatus === "connected" ? (
            <Wifi style={{ width: 11, height: 11, color: "#34d399" }} />
          ) : (
            <WifiOff style={{ width: 11, height: 11, color: "#f87171" }} />
          )}
          <button
            onClick={() => void refetch()}
            className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/8 transition-colors"
            style={{ color: "rgba(148,163,184,0.5)" }}
            title="Refresh sessions"
            data-testid="button-refresh-sessions"
          >
            <RefreshCw style={{ width: 11, height: 11 }} />
          </button>
        </div>
      </div>

      {/* Last event timestamp */}
      {lastEvent && (
        <div
          className="px-4 py-1.5 flex items-center gap-1.5 text-[10px] flex-shrink-0"
          style={{ background: "rgba(96,165,250,0.05)", borderBottom: "1px solid rgba(96,165,250,0.08)", color: "rgba(148,163,184,0.45)" }}
        >
          <span className="w-1 h-1 rounded-full" style={{ background: "#60a5fa", animation: "pulse 2s ease-in-out infinite" }} />
          Live — last event {new Date(lastEvent).toLocaleTimeString()}
        </div>
      )}

      {/* Session list */}
      <div className="flex-1 overflow-y-auto py-4 px-4 flex flex-col gap-3">
        {isLoading && allSessions.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "rgba(96,165,250,0.3)", borderTopColor: "#60a5fa" }} />
          </div>
        ) : allSessions.length === 0 ? (
          <EmptyState />
        ) : (
          allSessions.map((s) => <SessionCard key={s.sessionId} session={s} />)
        )}
      </div>
    </div>
  );
}
