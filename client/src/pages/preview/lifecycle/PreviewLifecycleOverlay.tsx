/**
 * PreviewLifecycleOverlay.tsx
 *
 * States:
 *  - crashed      → "Your 'Start application' artifact crashed" card + error log + Debug with Agent
 *  - reconnecting → skeleton background + centered reconnecting card
 *  - all others   → thin top progress bar + compact status chip (non-blocking)
 */

import { useEffect, useRef, useState } from "react";
import type { PreviewLifecycleState } from "./preview-lifecycle-types";
import { STATE_CONFIG } from "./preview-lifecycle-types";
import "./lifecycle-animations.css";

interface Props {
  state:     PreviewLifecycleState;
  prevState: PreviewLifecycleState;
  message:   string;
  meta?:     Record<string, unknown>;
  onRun?:    () => void;
  onRetry?:  () => void;
}

const VISIBLE_STATES = new Set<PreviewLifecycleState>([
  "building", "installing", "starting", "verifying",
  "restarting", "updating", "refreshing", "hot_reloading",
  "self_healing", "debugging", "patching",
  "crashed", "reconnecting",
]);

const HEAL_PHASES = [
  "Reading crash logs…",
  "Identifying root cause…",
  "Generating patch…",
  "Applying fix…",
  "Verifying health…",
];

export function PreviewLifecycleOverlay({ state, message, meta, onRun, onRetry }: Props) {
  const cfg             = STATE_CONFIG[state];
  const [show, setShow] = useState(false);
  const [healPhase, setHealPhase] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const healRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (VISIBLE_STATES.has(state)) {
      setShow(true);
    } else {
      timerRef.current = setTimeout(() => setShow(false), 500);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [state]);

  useEffect(() => {
    if (healRef.current) clearInterval(healRef.current);
    if (state === "self_healing" || state === "debugging" || state === "patching") {
      setHealPhase(0);
      healRef.current = setInterval(() => {
        setHealPhase(p => (p + 1) % HEAL_PHASES.length);
      }, 2200);
    }
    return () => { if (healRef.current) clearInterval(healRef.current); };
  }, [state]);

  if (!show) return null;

  // ── Crashed state ──────────────────────────────────────────────────────────
  if (state === "crashed") {
    return <CrashedOverlay message={message} meta={meta} onRun={onRun} onRetry={onRetry} />;
  }

  // ── Reconnecting state ─────────────────────────────────────────────────────
  if (state === "reconnecting") {
    return <ReconnectingOverlay />;
  }

  // ── Non-error states: compact top bar + status chip ───────────────────────
  const isHeal = state === "self_healing" || state === "debugging" || state === "patching";
  const isHot  = state === "hot_reloading";

  return (
    <div
      className={`preview-lifecycle-overlay ${VISIBLE_STATES.has(state) ? "plc-enter" : "plc-exit"}`}
      style={{
        "--plc-color": cfg.color,
        pointerEvents: "none",
        alignItems: "flex-start",
        justifyContent: "center",
      } as React.CSSProperties}
    >
      {/* Thin top progress bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
        {cfg.showBar ? (
          <div className="plc-progress-bar" style={{ background: cfg.color }} />
        ) : (
          <div style={{ height: "100%", width: "35%", background: `linear-gradient(90deg, transparent, ${cfg.color}99, transparent)`, animation: "idle-shimmer 1.6s ease-in-out infinite" }} />
        )}
      </div>

      {/* Compact floating chip */}
      <div style={{
        marginTop: "10px",
        display: "flex", alignItems: "center", gap: "6px",
        padding: "4px 12px", borderRadius: "999px",
        background: "rgba(9,10,20,0.82)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        border: `1px solid ${cfg.color}33`, boxShadow: `0 0 12px ${cfg.color}22`,
        animation: "plc-card-in 0.2s cubic-bezier(0.22,1,0.36,1) forwards",
      }}>
        {cfg.showSpinner && !isHeal && (
          <div style={{ width: "10px", height: "10px", border: `1.5px solid ${cfg.color}33`, borderTopColor: cfg.color, borderRadius: "50%", animation: "plc-spin 0.7s linear infinite", flexShrink: 0 }} />
        )}
        {isHot  && <PulseDot color={cfg.color} pulse="plc-dot-pulse 0.6s ease-out" />}
        {isHeal && <PulseDot color={cfg.color} pulse="plc-dot-pulse 1s ease-in-out infinite" />}
        <span style={{ fontSize: "11px", fontWeight: 600, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", color: cfg.color, letterSpacing: "0.02em" }}>
          {isHeal ? HEAL_PHASES[healPhase] : cfg.label}
        </span>
      </div>
    </div>
  );
}

// ── Crashed overlay (matches screenshot 2) ────────────────────────────────────

function CrashedOverlay({
  message, meta, onRun, onRetry,
}: { message: string; meta?: Record<string, unknown>; onRun?: () => void; onRetry?: () => void }) {
  const workflowName = (meta?.workflowName as string | undefined) ?? "Start application";
  const crashLog     = (meta?.crashLog as string | undefined) ?? message;
  const [debugBusy, setDebugBusy] = useState(false);

  function handleDebugWithAgent() {
    setDebugBusy(true);
    // Fire event that the workspace chat panel picks up
    window.dispatchEvent(new CustomEvent("nurax:debug-crash", {
      detail: {
        workflowName,
        crashLog,
        prompt: `Debug this crash in the "${workflowName}" workflow:\n\n${crashLog}\n\nAnalyze the error, find the root cause, and fix it.`,
      },
    }));
    setTimeout(() => setDebugBusy(false), 2000);
  }

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 30,
      background: "#1a1a1a",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: 20, padding: 24,
    }}>
      {/* Icon */}
      <MonitorOffIcon />

      {/* Title */}
      <p style={{ color: "#e5e7eb", fontSize: 17, fontWeight: 600, margin: 0, textAlign: "center", letterSpacing: "-0.01em" }}>
        Your '{workflowName}' artifact crashed
      </p>

      {/* Error log box */}
      {crashLog && (
        <pre style={{
          width: "100%", maxWidth: 520, maxHeight: 140,
          background: "#111", border: "1px solid #2a2a2a",
          borderRadius: 8, padding: "12px 14px",
          fontSize: 12.5, fontFamily: "ui-monospace,'SF Mono',Menlo,monospace",
          color: "#d1d5db", overflowY: "auto", overflowX: "auto",
          whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.6,
          scrollbarWidth: "thin",
        }}>
          {crashLog}
        </pre>
      )}

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Debug with Agent button + dropdown caret */}
        <div style={{ display: "flex", borderRadius: 8, overflow: "hidden" }}>
          <button
            onClick={handleDebugWithAgent}
            disabled={debugBusy}
            data-testid="button-debug-with-agent"
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "9px 16px",
              background: "#2a2d3e", color: "#c4b5fd",
              border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 600,
              transition: "background 0.15s", opacity: debugBusy ? 0.7 : 1,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "#343754")}
            onMouseLeave={e => (e.currentTarget.style.background = "#2a2d3e")}
          >
            <AgentIcon />
            {debugBusy ? "Sending to Agent…" : "Debug with Agent"}
          </button>
          <div style={{ width: 1, background: "#1a1a2e" }} />
          <button
            style={{
              padding: "9px 10px",
              background: "#2a2d3e", color: "#c4b5fd",
              border: "none", cursor: "pointer", fontSize: 13,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "#343754")}
            onMouseLeave={e => (e.currentTarget.style.background = "#2a2d3e")}
            data-testid="button-debug-dropdown"
            title="More options"
          >
            <ChevronDown />
          </button>
        </div>

        {/* Restart */}
        {onRun && (
          <button
            onClick={onRun}
            data-testid="button-overlay-restart"
            style={{
              padding: "9px 16px",
              background: "transparent", color: "#9ca3af",
              border: "1px solid #374151", borderRadius: 8,
              cursor: "pointer", fontSize: 13, fontWeight: 500,
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#1f2937"; e.currentTarget.style.color = "#e5e7eb"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9ca3af"; }}
          >
            Restart
          </button>
        )}
      </div>
    </div>
  );
}

// ── Reconnecting overlay (matches screenshot 3) ────────────────────────────────

function ReconnectingOverlay() {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 30, background: "#1a1a1a" }}>
      {/* Skeleton background */}
      <SkeletonBg />

      {/* Centered reconnecting card */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          background: "#242424", border: "1px solid #2f2f2f",
          borderRadius: 12, padding: "32px 40px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
          minWidth: 220,
        }}>
          {/* Spinner */}
          <div style={{
            width: 32, height: 32,
            border: "3px solid #2f2f2f",
            borderTopColor: "#9ca3af",
            borderRadius: "50%",
            animation: "plc-spin 0.9s linear infinite",
          }} />
          <span style={{ color: "#d1d5db", fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>
            Reconnecting...
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton background ────────────────────────────────────────────────────────

function SkeletonBg() {
  const bar = (w: string, h = 14, mt = 0) => (
    <div style={{
      width: w, height: h, borderRadius: 6,
      background: "linear-gradient(90deg, #252525 0%, #2e2e2e 50%, #252525 100%)",
      backgroundSize: "200% 100%",
      animation: "skeleton-shimmer 1.6s ease-in-out infinite",
      marginTop: mt,
      flexShrink: 0,
    }} />
  );

  return (
    <div style={{ position: "absolute", inset: 0, padding: "24px 20px", display: "flex", flexDirection: "column", gap: 10, opacity: 0.6 }}>
      {bar("85%", 16)}
      {bar("60%", 14)}
      {bar("40%", 14)}
      <div style={{ marginTop: 12, padding: 16, border: "1px solid #2a2a2a", borderRadius: 8, display: "flex", flexDirection: "column", gap: 10, height: 180, overflow: "hidden" }}>
        {bar("90%", 13)}
        {bar("70%", 13)}
        {bar("55%", 13)}
        {bar("80%", 13)}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        {bar("80px", 56)}
        {bar("calc(50% - 90px)", 56)}
        {bar("calc(50% - 10px)", 56)}
      </div>
      {bar("70%", 13, 8)}
      {bar("50%", 13, 4)}
      <style>{`
        @keyframes skeleton-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

// ── Shared icons ──────────────────────────────────────────────────────────────

function PulseDot({ color, pulse }: { color: string; pulse: string }) {
  return <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: color, flexShrink: 0, animation: pulse }} />;
}

function MonitorOffIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none"
      stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 17H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h16a2 2 0 0 1 2 2v8" />
      <path d="M8 21h8" /><path d="M12 17v4" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

function AgentIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <circle cx="5" cy="5" r="1.5" fill="currentColor" opacity="0.7" />
      <circle cx="10" cy="5" r="1.5" fill="currentColor" opacity="0.7" />
      <circle cx="7.5" cy="10" r="1.5" fill="currentColor" opacity="0.7" />
      <line x1="5" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      <line x1="5" y1="5" x2="7.5" y2="10" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      <line x1="10" y1="5" x2="7.5" y2="10" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 4l4 4 4-4" />
    </svg>
  );
}
