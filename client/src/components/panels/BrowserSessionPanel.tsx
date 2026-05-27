/**
 * BrowserSessionPanel.tsx
 * Live status panel for Playwright browser sessions.
 * Shows active sessions, screenshots, validation results, and lifecycle events.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRealtime } from "@/realtime/realtime-provider";
import { TOPIC } from "@/realtime/realtime-events";
import {
  MonitorPlay, CheckCircle2, XCircle, AlertCircle,
  Camera, Globe, Clock, RefreshCw, Wifi, WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

interface SessionSnapshot {
  sessionId:  string;
  runId:      string;
  projectId:  number | null;
  status:     string;
  pagesOpen:  number;
  launchedAt: string | null;
  closedAt:   string | null;
}

interface SessionState extends SessionSnapshot {
  screenshots: Array<{ label: string; path: string; url: string; ts: string }>;
  consoleErrors: number;
  lastValidation?: "passed" | "failed";
  lastUrl?: string;
  lastError?: string;
  events: Array<{ type: string; ts: string; label?: string }>;
}

interface BrowserSessionEvent {
  type:            string;
  sessionId:       string;
  runId:           string;
  projectId?:      number;
  label?:          string;
  screenshotPath?: string;
  error?:          string;
  url?:            string;
  timestamp:       string;
}

interface SessionsResponse {
  ok:       boolean;
  count:    number;
  active:   number;
  sessions: SessionSnapshot[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function elapsed(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const s  = Math.floor(ms / 1000);
  if (s < 60)  return `${s}s`;
  const m  = Math.floor(s / 60);
  if (m < 60)  return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  launching:   { label: "Launching",  dot: "#fbbf24", badge: "rgba(251,191,36,0.14)" },
  ready:       { label: "Ready",      dot: "#34d399", badge: "rgba(52,211,153,0.14)" },
  navigating:  { label: "Navigating", dot: "#60a5fa", badge: "rgba(96,165,250,0.14)" },
  capturing:   { label: "Capturing",  dot: "#a78bfa", badge: "rgba(167,139,250,0.14)" },
  validating:  { label: "Validating", dot: "#fbbf24", badge: "rgba(251,191,36,0.14)" },
  closing:     { label: "Closing",    dot: "#94a3b8", badge: "rgba(148,163,184,0.12)" },
  closed:      { label: "Closed",     dot: "#475569", badge: "rgba(71,85,105,0.14)" },
  crashed:     { label: "Crashed",    dot: "#f87171", badge: "rgba(248,113,113,0.14)" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, dot: "#94a3b8", badge: "rgba(148,163,184,0.1)" };
  return (
    <span
      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
      style={{ background: cfg.badge, color: cfg.dot, border: `1px solid ${cfg.dot}33` }}
      data-testid={`status-badge-${status}`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{
          background: cfg.dot,
          boxShadow: status === "ready" ? `0 0 6px ${cfg.dot}` : undefined,
          animation: status === "launching" || status === "navigating" ? "pulse 1.4s ease-in-out infinite" : undefined,
        }}
      />
      {cfg.label}
    </span>
  );
}

// ── Screenshot thumbnail ───────────────────────────────────────────────────────

function ScreenshotThumb({ url, label }: { url: string; label: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div
      className="relative rounded-lg overflow-hidden flex-shrink-0"
      style={{ width: 96, height: 60, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
      title={label}
      data-testid="img-screenshot-thumb"
    >
      {!failed ? (
        <img
          src={url}
          alt={label}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn("w-full h-full object-cover transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0")}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Camera style={{ width: 16, height: 16, color: "rgba(148,163,184,0.3)" }} />
        </div>
      )}
      {!loaded && !failed && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full border border-t-transparent animate-spin" style={{ borderColor: "rgba(96,165,250,0.4)", borderTopColor: "transparent" }} />
        </div>
      )}
      <div
        className="absolute bottom-0 inset-x-0 px-1.5 py-0.5 text-[9px] truncate"
        style={{ background: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.7)" }}
      >
        {label || "screenshot"}
      </div>
    </div>
  );
}

// ── Session card ───────────────────────────────────────────────────────────────

function SessionCard({ session }: { session: SessionState }) {
  const lastShot = session.screenshots[session.screenshots.length - 1];
  const isDead   = session.status === "closed" || session.status === "crashed";
  return (
    <div
      className="rounded-xl p-3.5 flex flex-col gap-2.5"
      style={{
        background: isDead ? "rgba(255,255,255,0.015)" : "rgba(255,255,255,0.035)",
        border: `1px solid ${isDead ? "rgba(255,255,255,0.055)" : "rgba(255,255,255,0.09)"}`,
        opacity: isDead ? 0.65 : 1,
      }}
      data-testid={`card-session-${session.sessionId}`}
    >
      {/* Row 1: ID, status, duration */}
      <div className="flex items-center gap-2 flex-wrap">
        <MonitorPlay style={{ width: 13, height: 13, color: "rgba(96,165,250,0.7)", flexShrink: 0 }} />
        <span
          className="font-mono text-[11px]"
          style={{ color: "rgba(226,232,240,0.75)" }}
          data-testid="text-session-id"
        >
          {shortId(session.sessionId)}
        </span>
        <StatusBadge status={session.status} />
        <span className="text-[10px] flex items-center gap-1 ml-auto" style={{ color: "rgba(148,163,184,0.55)" }}>
          <Clock style={{ width: 10, height: 10 }} />
          {elapsed(session.launchedAt)}
        </span>
      </div>

      {/* Row 2: runId + pages */}
      <div className="flex items-center gap-3 text-[10.5px]" style={{ color: "rgba(148,163,184,0.5)" }}>
        <span>Run: <span className="font-mono" style={{ color: "rgba(148,163,184,0.7)" }}>{shortId(session.runId)}</span></span>
        <span className="flex items-center gap-1">
          <Globe style={{ width: 9, height: 9 }} />
          {session.pagesOpen} page{session.pagesOpen !== 1 ? "s" : ""}
        </span>
        {session.consoleErrors > 0 && (
          <span className="flex items-center gap-1" style={{ color: "#f87171" }}>
            <AlertCircle style={{ width: 9, height: 9 }} />
            {session.consoleErrors} error{session.consoleErrors !== 1 ? "s" : ""}
          </span>
        )}
        {session.lastValidation === "passed" && (
          <span className="flex items-center gap-1" style={{ color: "#34d399" }}>
            <CheckCircle2 style={{ width: 9, height: 9 }} /> Validated
          </span>
        )}
        {session.lastValidation === "failed" && (
          <span className="flex items-center gap-1" style={{ color: "#f87171" }}>
            <XCircle style={{ width: 9, height: 9 }} /> Failed
          </span>
        )}
      </div>

      {/* Row 3: last URL */}
      {session.lastUrl && (
        <div
          className="font-mono text-[10px] truncate px-2 py-1 rounded-md"
          style={{ background: "rgba(255,255,255,0.035)", color: "rgba(148,163,184,0.55)" }}
          title={session.lastUrl}
          data-testid="text-session-url"
        >
          {session.lastUrl}
        </div>
      )}

      {/* Row 4: screenshot thumbnail strip */}
      {session.screenshots.length > 0 && (
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {session.screenshots.slice(-5).map((s, i) => (
            <ScreenshotThumb key={i} url={s.url} label={s.label} />
          ))}
        </div>
      )}

      {/* Row 5: crash error */}
      {session.status === "crashed" && session.lastError && (
        <div
          className="rounded-md px-2.5 py-1.5 text-[10.5px]"
          style={{ background: "rgba(248,113,113,0.08)", color: "#fca5a5", border: "1px solid rgba(248,113,113,0.15)" }}
          data-testid="text-session-error"
        >
          {session.lastError}
        </div>
      )}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.15)" }}
      >
        <MonitorPlay style={{ width: 24, height: 24, color: "rgba(96,165,250,0.5)" }} />
      </div>
      <p className="text-sm" style={{ color: "rgba(148,163,184,0.55)" }}>No browser sessions</p>
      <p className="text-[11px] text-center max-w-xs" style={{ color: "rgba(148,163,184,0.35)" }}>
        Browser sessions appear here when the agent runs Playwright automation.
      </p>
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export function BrowserSessionPanel() {
  const [sessions, setSessions] = useState<Map<string, SessionState>>(new Map());
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const { subscribe, status: realtimeStatus } = useRealtime();
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Initial data from REST ─────────────────────────────────────────────────
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

  // ── Live elapsed timer ─────────────────────────────────────────────────────
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setSessions((s) => new Map(s));  // force re-render to update elapsed
    }, 5_000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  // ── SSE subscription ───────────────────────────────────────────────────────
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

  // ── Render ─────────────────────────────────────────────────────────────────
  const allSessions = Array.from(sessions.values()).sort((a, b) => {
    // Active first, then by launch time descending
    const aDead = a.status === "closed" || a.status === "crashed";
    const bDead = b.status === "closed" || b.status === "crashed";
    if (aDead !== bDead) return aDead ? 1 : -1;
    return (b.launchedAt ?? "").localeCompare(a.launchedAt ?? "");
  });

  const activeSessions = allSessions.filter((s) => s.status !== "closed" && s.status !== "crashed");

  return (
    <div className="flex flex-col h-full overflow-hidden" data-testid="panel-browser-sessions">

      {/* ── Header ── */}
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
          {/* Realtime connection indicator */}
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

      {/* ── Last event timestamp ── */}
      {lastEvent && (
        <div
          className="px-4 py-1.5 flex items-center gap-1.5 text-[10px] flex-shrink-0"
          style={{ background: "rgba(96,165,250,0.05)", borderBottom: "1px solid rgba(96,165,250,0.08)", color: "rgba(148,163,184,0.45)" }}
        >
          <span className="w-1 h-1 rounded-full" style={{ background: "#60a5fa", animation: "pulse 2s ease-in-out infinite" }} />
          Live — last event {new Date(lastEvent).toLocaleTimeString()}
        </div>
      )}

      {/* ── Session list ── */}
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
