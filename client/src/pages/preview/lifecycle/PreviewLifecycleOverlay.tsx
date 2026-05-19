/**
 * PreviewLifecycleOverlay.tsx — animated overlay for every preview state.
 *
 * Renders on top of the iframe with smooth enter/exit transitions.
 * Only visible when state !== "ready" && state !== "idle".
 *
 * Two action props:
 *   onRun   — triggers an actual process restart (used on crashed state)
 *   onRetry — refreshes the iframe only (lightweight reload)
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
  /** Full process restart — shown on crash state */
  onRun?:   () => void;
  /** Lightweight iframe reload — shown as secondary on crash state */
  onRetry?: () => void;
}

const VISIBLE_STATES = new Set<PreviewLifecycleState>([
  "building", "installing", "starting", "restarting",
  "updating", "refreshing", "crashed", "reconnecting",
]);

export function PreviewLifecycleOverlay({ state, message, meta, onRun, onRetry }: Props) {
  const cfg           = STATE_CONFIG[state];
  const [show, setShow] = useState(false);
  const timerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (VISIBLE_STATES.has(state)) {
      setShow(true);
    } else {
      timerRef.current = setTimeout(() => setShow(false), 600);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [state]);

  if (!show) return null;

  const visible = VISIBLE_STATES.has(state);

  return (
    <div
      className={`preview-lifecycle-overlay ${visible ? "plc-enter" : "plc-exit"}`}
      style={{ "--plc-color": cfg.color } as React.CSSProperties}
    >
      {/* Gradient backdrop */}
      <div className="plc-backdrop" />

      {/* Card */}
      <div className="plc-card">

        {/* State icon / spinner */}
        <div className="plc-icon-wrap">
          {cfg.showSpinner && !cfg.isError && (
            <div className="plc-spinner" style={{ borderTopColor: cfg.color }} />
          )}
          {cfg.isError && <CrashIcon color={cfg.color} />}
          {state === "reconnecting" && <ReconnectIcon color={cfg.color} />}
        </div>

        {/* Progress bar for active build/install states */}
        {cfg.showBar && (
          <div className="plc-progress-track">
            <div className="plc-progress-bar" style={{ background: cfg.color }} />
          </div>
        )}

        {/* Label */}
        <div className="plc-label" style={{ color: cfg.color }}>
          {cfg.label}
        </div>

        {/* Message */}
        <div className="plc-message">{message}</div>

        {/* Crash detail */}
        {cfg.isError && meta?.exitCode !== undefined && (
          <div className="plc-meta">Exit code: {String(meta.exitCode)}</div>
        )}

        {/* ── Crash action buttons ─────────────────────────────────── */}
        {cfg.isError && (
          <div className="plc-actions">
            {onRun && (
              <button
                className="plc-btn plc-btn-primary"
                onClick={onRun}
                data-testid="button-overlay-restart"
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ marginRight: 5, display: "inline" }}>
                  <path d="M9.5 5.5a4 4 0 1 1-1.17-2.83" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                  <path d="M9.5 2v3.5H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
                Restart
              </button>
            )}
            {onRetry && (
              <button
                className="plc-btn plc-btn-secondary"
                onClick={onRetry}
                data-testid="button-overlay-reload"
              >
                Reload
              </button>
            )}
          </div>
        )}
      </div>

      {/* Particle dots for active (non-error) states */}
      {cfg.showSpinner && !cfg.isError && (
        <div className="plc-particles">
          {[0,1,2,3,4].map(i => (
            <div
              key={i}
              className="plc-particle"
              style={{
                "--delay":  `${i * 0.18}s`,
                "--x":      `${(Math.sin(i * 1.26) * 120).toFixed(0)}px`,
                "--y":      `${(Math.cos(i * 1.26) * 80).toFixed(0)}px`,
                background: cfg.color,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sub-icons ──────────────────────────────────────────────────────────────────

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
