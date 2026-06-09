/**
 * PreviewPlaceholder.tsx
 *
 * "Your app is not running" full-page state — Replit-style.
 * Shown when lifecycle state is "idle".
 */

import { useEffect, useState } from "react";

interface Props {
  onRun?: () => void;
}

export function PreviewPlaceholder({ onRun }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  return (
    <div
      data-testid="preview-placeholder"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 20,
        background: "#1a1a1a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 20,
        opacity: mounted ? 1 : 0,
        transition: "opacity 0.25s ease",
        userSelect: "none",
      }}
    >
      {/* Monitor with slash icon */}
      <MonitorOffIcon />

      {/* Title */}
      <p style={{
        color: "#e5e7eb",
        fontSize: 18,
        fontWeight: 600,
        margin: 0,
        letterSpacing: "-0.01em",
      }}>
        Your app is not running
      </p>

      {/* Run button row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={onRun}
          data-testid="button-preview-run"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "8px 20px",
            background: "#22c55e",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            transition: "background 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "#16a34a")}
          onMouseLeave={e => (e.currentTarget.style.background = "#22c55e")}
        >
          <PlayIcon />
          Run
        </button>
        <span style={{ color: "#6b7280", fontSize: 14 }}>to preview your app.</span>
      </div>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function MonitorOffIcon() {
  return (
    <svg
      width="72" height="72"
      viewBox="0 0 24 24" fill="none"
      stroke="#4b5563" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17 17H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h16a2 2 0 0 1 2 2v8" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <path d="M2.5 1.5 L10 6 L2.5 10.5 Z" />
    </svg>
  );
}
