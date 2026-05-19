/**
 * PreviewPlaceholder.tsx
 *
 * Shown inside the iframe area when lifecycle state is "idle" —
 * no project is running yet. Clean waiting screen — NO run button.
 * The AI agent will automatically start the project; the user doesn't
 * need to trigger it manually from here.
 *
 * The crash state has its own restart button in PreviewLifecycleOverlay.
 */

import { useEffect, useRef, useState } from "react";
import "./placeholder-animations.css";

const DOT_GRID = [
  { filled: true,  delay: 0.0  },
  { filled: true,  delay: 0.1  },
  { filled: false, delay: 0.2  },
  { filled: true,  delay: 0.15 },
  { filled: false, delay: 0.05 },
  { filled: true,  delay: 0.25 },
  { filled: false, delay: 0.3  },
  { filled: true,  delay: 0.1  },
  { filled: true,  delay: 0.2  },
];

export function PreviewPlaceholder() {
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
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.25" />
          <path d="M5.5 5.5 C5.5 4.5 8.5 4.5 8.5 6.5 C8.5 7.5 7 7.5 7 8.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
          <circle cx="7" cy="10" r="0.75" fill="currentColor" />
        </svg>
        <span>Ask the AI agent to run your project</span>
      </div>

      {/* Pulse dots at bottom */}
      <div className="nph-pulse-row">
        {[0, 1, 2].map(i => (
          <div key={i} className="nph-pulse-dot" style={{ "--pd-delay": `${i * 0.22}s` } as React.CSSProperties} />
        ))}
      </div>
    </div>
  );
}
