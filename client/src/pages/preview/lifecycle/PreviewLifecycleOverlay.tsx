/**
 * PreviewLifecycleOverlay.tsx — compact overlay for every preview state.
 *
 * Non-error states (building, starting, installing, etc.):
 *   → Thin top progress bar + small floating status chip
 *   → No full-page backdrop or blocking content
 *
 * Error states (crashed, reconnecting):
 *   → Full card with backdrop + restart / AI-fix actions
 *
 * v3: Compact non-error states — real-browser feel.
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

const ERROR_STATES = new Set<PreviewLifecycleState>(["crashed", "reconnecting"]);

// Self-healing phase labels shown sequentially
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
  const timerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const healRef         = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const visible  = VISIBLE_STATES.has(state);
  const isError  = ERROR_STATES.has(state);
  const isHeal   = state === "self_healing" || state === "debugging" || state === "patching";
  const isHot    = state === "hot_reloading";

  // ── Error state: full card with backdrop ─────────────────────────────
  if (isError) {
    return (
      <div
        className={`preview-lifecycle-overlay ${visible ? "plc-enter" : "plc-exit"}`}
        style={{ "--plc-color": cfg.color } as React.CSSProperties}
      >
        <div className="plc-backdrop" />
        <div className="plc-card">
          <div className="plc-icon-wrap">
            {state === "crashed"     && <CrashIcon color={cfg.color} />}
            {state === "reconnecting"&& <ReconnectIcon color={cfg.color} />}
          </div>
          <div className="plc-label" style={{ color: cfg.color }}>{cfg.label}</div>
          <div className="plc-message">{message}</div>
          {state === "crashed" && meta?.exitCode !== undefined && (
            <div className="plc-meta">Exit code: {String(meta.exitCode)}</div>
          )}
          <div className="plc-actions">
            {onRun && (
              <button className="plc-btn plc-btn-primary" onClick={onRun} data-testid="button-overlay-restart">
                <RestartSvg /> Restart
              </button>
            )}
            {onRetry && (
              <button className="plc-btn plc-btn-secondary" onClick={onRetry} data-testid="button-overlay-reload">
                Reload
              </button>
            )}
          </div>
          {onRun && (
            <button
              className="plc-btn plc-btn-heal"
              onClick={onRun}
              data-testid="button-overlay-ai-fix"
              style={{ borderColor: "#e879f9", color: "#e879f9" }}
            >
              <span style={{ marginRight: 5 }}>✦</span> Ask AI to Fix
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Non-error state: compact top bar + status chip ────────────────────
  return (
    <div
      className={`preview-lifecycle-overlay ${visible ? "plc-enter" : "plc-exit"}`}
      style={{
        "--plc-color": cfg.color,
        pointerEvents: "none",
        alignItems: "flex-start",
        justifyContent: "center",
      } as React.CSSProperties}
    >
      {/* Thin top progress bar */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "2px",
        background: "rgba(255,255,255,0.05)",
        overflow: "hidden",
      }}>
        {cfg.showBar ? (
          <div
            className="plc-progress-bar"
            style={{ background: cfg.color }}
          />
        ) : (
          /* shimmer for states without a real bar */
          <div style={{
            height: "100%",
            width: "35%",
            background: `linear-gradient(90deg, transparent, ${cfg.color}99, transparent)`,
            animation: "idle-shimmer 1.6s ease-in-out infinite",
          }} />
        )}
      </div>

      {/* Compact floating status chip — top-center */}
      <div style={{
        marginTop: "10px",
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 12px",
        borderRadius: "999px",
        background: "rgba(9,10,20,0.82)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        border: `1px solid ${cfg.color}33`,
        boxShadow: `0 0 12px ${cfg.color}22`,
        animation: "plc-card-in 0.2s cubic-bezier(0.22,1,0.36,1) forwards",
      }}>
        {/* Spinner or icon */}
        {cfg.showSpinner && !isHeal && (
          <div style={{
            width: "10px",
            height: "10px",
            border: `1.5px solid ${cfg.color}33`,
            borderTopColor: cfg.color,
            borderRadius: "50%",
            animation: "plc-spin 0.7s linear infinite",
            flexShrink: 0,
          }} />
        )}
        {isHot && <HotDot color={cfg.color} />}
        {isHeal && <HealDot color={cfg.color} />}

        <span style={{
          fontSize: "11px",
          fontWeight: 600,
          fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
          color: cfg.color,
          letterSpacing: "0.02em",
        }}>
          {isHeal ? HEAL_PHASES[healPhase] : cfg.label}
        </span>
      </div>
    </div>
  );
}

// ── Minimal icons ──────────────────────────────────────────────────────────────

function HotDot({ color }: { color: string }) {
  return (
    <span style={{
      width: "8px", height: "8px", borderRadius: "50%",
      background: color, flexShrink: 0,
      animation: "plc-dot-pulse 0.6s ease-out",
      boxShadow: `0 0 6px ${color}`,
    }} />
  );
}

function HealDot({ color }: { color: string }) {
  return (
    <span style={{
      width: "8px", height: "8px", borderRadius: "50%",
      background: color, flexShrink: 0,
      animation: "plc-dot-pulse 1s ease-in-out infinite",
    }} />
  );
}

function CrashIcon({ color }: { color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="plc-crash-icon">
      <circle cx="20" cy="20" r="18" stroke={color} strokeWidth="2" opacity="0.3" />
      <path d="M20 12v10" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="20" cy="27" r="1.5" fill={color} />
    </svg>
  );
}

function ReconnectIcon({ color }: { color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="plc-reconnect-icon">
      <path d="M8 20a12 12 0 1 1 2 6.9" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M8 28v-8h8" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function RestartSvg() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none"
      style={{ marginRight: 5, display: "inline" }}>
      <path d="M9.5 5.5a4 4 0 1 1-1.17-2.83" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M9.5 2v3.5H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
