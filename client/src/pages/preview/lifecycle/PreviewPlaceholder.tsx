/**
 * PreviewPlaceholder.tsx
 *
 * Shown inside the iframe area when lifecycle state is "idle" —
 * i.e. no project is running yet. Mirrors the Replit-style
 * "Preview will be available soon" UX with NURA X branding.
 */

import { useEffect, useRef, useState } from "react";
import "./placeholder-animations.css";

interface Props {
  onRun?: () => void;
}

const DOT_GRID = [
  // row 0
  { filled: true,  delay: 0.0  },
  { filled: true,  delay: 0.1  },
  { filled: false, delay: 0.2  },
  // row 1
  { filled: true,  delay: 0.15 },
  { filled: false, delay: 0.05 },
  { filled: true,  delay: 0.25 },
  // row 2
  { filled: false, delay: 0.3  },
  { filled: true,  delay: 0.1  },
  { filled: true,  delay: 0.2  },
];

export function PreviewPlaceholder({ onRun }: Props) {
  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    intervalRef.current = setInterval(() => setTick(t => t + 1), 1800);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div
      className={`nph-root ${mounted ? "nph-in" : ""}`}
      data-testid="preview-placeholder"
    >
      {/* subtle radial glow */}
      <div className="nph-glow" />

      {/* Logo grid — animated dots */}
      <div className="nph-logo-wrap">
        <div className="nph-dot-grid">
          {DOT_GRID.map((dot, i) => (
            <div
              key={i}
              className={`nph-dot ${dot.filled ? "nph-dot-filled" : "nph-dot-empty"}`}
              style={{
                "--dot-delay": `${dot.delay + (tick % 2 === 0 ? 0 : 0.05)}s`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      </div>

      {/* Heading */}
      <h2 className="nph-title">Preview will be available soon</h2>

      {/* Hint row */}
      <div className="nph-hint">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="nph-hint-icon">
          <rect x="1.5" y="1.5" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.25" strokeDasharray="2 1.5" />
          <path d="M5 9 L9 5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
          <circle cx="9" cy="5" r="1" fill="currentColor" />
        </svg>
        <span>Run your project to see it live here</span>
      </div>

      {/* Optional run button */}
      {onRun && (
        <button
          className="nph-run-btn"
          onClick={onRun}
          data-testid="button-placeholder-run"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M3.5 2.5 L10.5 6.5 L3.5 10.5 Z" fill="currentColor" />
          </svg>
          Run Project
        </button>
      )}

      {/* Pulse dots at bottom */}
      <div className="nph-pulse-row">
        {[0, 1, 2].map(i => (
          <div key={i} className="nph-pulse-dot" style={{ "--pd-delay": `${i * 0.22}s` } as React.CSSProperties} />
        ))}
      </div>
    </div>
  );
}
