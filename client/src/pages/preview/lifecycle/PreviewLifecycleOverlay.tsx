/**
 * PreviewLifecycleOverlay.tsx — animated overlay for every preview state.
 *
 * Renders on top of the iframe with smooth enter/exit transitions.
 * Only visible when state !== "ready" && state !== "idle".
 *
 * v2: New icons for verifying, hot_reloading, self_healing, debugging, patching.
 *     Self-healing state shows AI progress phases.
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
      timerRef.current = setTimeout(() => setShow(false), 600);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [state]);

  // Cycle heal phases while self_healing
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

  const visible = VISIBLE_STATES.has(state);
  const isHeal  = state === "self_healing" || state === "debugging" || state === "patching";
  const isHot   = state === "hot_reloading";

  return (
    <div
      className={`preview-lifecycle-overlay ${visible ? "plc-enter" : "plc-exit"}`}
      style={{ "--plc-color": cfg.color } as React.CSSProperties}
    >
      <div className="plc-backdrop" />

      <div className={`plc-card ${isHot ? "plc-card-hot" : ""}`}>

        {/* State icon */}
        <div className="plc-icon-wrap">
          {cfg.icon === "spinner"   && <div className="plc-spinner" style={{ borderTopColor: cfg.color }} />}
          {cfg.icon === "crash"     && <CrashIcon color={cfg.color} />}
          {cfg.icon === "reconnect" && <ReconnectIcon color={cfg.color} />}
          {cfg.icon === "verify"    && <VerifyIcon color={cfg.color} />}
          {cfg.icon === "heal"      && <HealIcon color={cfg.color} />}
          {cfg.icon === "hotreload" && <HotReloadIcon color={cfg.color} />}
          {cfg.icon === "debug"     && <DebugIcon color={cfg.color} />}
          {cfg.icon === "patch"     && <PatchIcon color={cfg.color} />}
          {!cfg.icon && cfg.showSpinner && <div className="plc-spinner" style={{ borderTopColor: cfg.color }} />}
        </div>

        {/* Progress bar */}
        {cfg.showBar && (
          <div className="plc-progress-track">
            <div className="plc-progress-bar" style={{ background: cfg.color }} />
          </div>
        )}

        {/* Label */}
        <div className="plc-label" style={{ color: cfg.color }}>
          {cfg.label}
        </div>

        {/* AI self-heal phase steps */}
        {isHeal ? (
          <div className="plc-heal-phases">
            {HEAL_PHASES.map((phase, i) => (
              <div
                key={phase}
                className={`plc-heal-phase ${i === healPhase ? "active" : i < healPhase ? "done" : "pending"}`}
              >
                <span className="plc-heal-dot" />
                {phase}
              </div>
            ))}
          </div>
        ) : (
          <div className="plc-message">{message}</div>
        )}

        {/* Crash meta */}
        {cfg.isError && meta?.exitCode !== undefined && (
          <div className="plc-meta">Exit code: {String(meta.exitCode)}</div>
        )}

        {/* Hot reload badge */}
        {isHot && (
          <div className="plc-hot-badge" style={{ color: cfg.color }}>
            CSS-only · no restart needed
          </div>
        )}

        {/* Crash actions */}
        {cfg.isError && (
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
        )}

        {/* Crashed → ask AI to fix */}
        {cfg.isError && onRun && (
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

      {/* Particle dots for active non-error states */}
      {cfg.showSpinner && !cfg.isError && !isHot && (
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

      {/* Hot reload flash ring */}
      {isHot && <div className="plc-hot-flash" style={{ borderColor: cfg.color }} />}
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────────

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

function VerifyIcon({ color }: { color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="plc-verify-icon">
      <circle cx="20" cy="20" r="17" stroke={color} strokeWidth="2" opacity="0.25" />
      <circle cx="20" cy="20" r="17" stroke={color} strokeWidth="2" strokeDasharray="107" strokeDashoffset="107"
        style={{ animation: "plc-verify-draw 1.1s cubic-bezier(0.4,0,0.2,1) forwards" }} />
      <path d="M13 20.5l5 5 9-10" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ animation: "plc-check-draw 0.4s 0.9s ease forwards", opacity: 0 }} />
    </svg>
  );
}

function HealIcon({ color }: { color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="plc-heal-icon">
      <circle cx="20" cy="20" r="17" stroke={color} strokeWidth="1.5" opacity="0.2" />
      <path d="M20 11c-5 0-9 4-9 9s4 9 9 9 9-4 9-9" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none"
        style={{ animation: "plc-spin 1.4s linear infinite" }} />
      <path d="M17 20h6M20 17v6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function HotReloadIcon({ color }: { color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="plc-hotreload-icon">
      <path d="M20 8 L24 16 L32 16 L26 22 L28 30 L20 26 L12 30 L14 22 L8 16 L16 16 Z"
        stroke={color} strokeWidth="1.5" fill={`${color}22`} strokeLinejoin="round"
        style={{ animation: "plc-hotreload-pulse 0.8s ease-out forwards" }} />
    </svg>
  );
}

function DebugIcon({ color }: { color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="plc-debug-icon">
      <circle cx="18" cy="18" r="9" stroke={color} strokeWidth="2" fill="none"
        style={{ animation: "plc-debug-scan 1.5s ease-in-out infinite" }} />
      <path d="M25 25 L32 32" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function PatchIcon({ color }: { color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="plc-patch-icon">
      <path d="M20 8l3 9h9l-7 5 3 9-8-6-8 6 3-9-7-5h9z" stroke={color} strokeWidth="1.5" fill={`${color}15`}
        strokeLinejoin="round" style={{ animation: "plc-patch-spin 2s linear infinite" }} />
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
