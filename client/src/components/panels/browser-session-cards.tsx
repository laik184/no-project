import { useState } from "react";
import {
  MonitorPlay, CheckCircle2, XCircle, AlertCircle,
  Camera, Globe, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SessionState, STATUS_CONFIG, elapsed, shortId } from "./browser-session-types";

export function StatusBadge({ status }: { status: string }) {
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

export function ScreenshotThumb({ url, label }: { url: string; label: string }) {
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

export function SessionCard({ session }: { session: SessionState }) {
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

      {session.screenshots.length > 0 && (
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {session.screenshots.slice(-5).map((s, i) => (
            <ScreenshotThumb key={i} url={s.url} label={s.label} />
          ))}
        </div>
      )}

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

export function EmptyState() {
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
