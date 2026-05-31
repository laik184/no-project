/**
 * PreviewPlaceholder.tsx
 *
 * Compact browser-style loading indicator shown inside the iframe area
 * when lifecycle state is "idle". Replaces the full-page placeholder.
 *
 * Shows only a thin animated progress bar at the top edge of the frame
 * and a small centered status chip — no full-page blocking content.
 */

import { useEffect, useState } from "react";

export function PreviewPlaceholder() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  return (
    <div
      className="preview-idle-shell"
      data-testid="preview-placeholder"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 20,
        background: "#0d0d0f",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: mounted ? 1 : 0,
        transition: "opacity 0.3s ease",
      }}
    >
      {/* Top progress shimmer */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "2px",
        background: "rgba(255,255,255,0.04)",
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%",
          width: "40%",
          background: "linear-gradient(90deg, transparent, rgba(124,141,255,0.6), transparent)",
          animation: "idle-shimmer 1.8s ease-in-out infinite",
        }} />
      </div>

      {/* Centered status chip */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 14px",
        borderRadius: "999px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.07)",
        color: "rgba(148,163,184,0.5)",
        fontSize: "11px",
        fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
        fontWeight: 500,
        userSelect: "none",
      }}>
        <span style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: "rgba(124,141,255,0.4)",
          animation: "idle-dot-pulse 2s ease-in-out infinite",
          flexShrink: 0,
        }} />
        Waiting for server
      </div>

      <style>{`
        @keyframes idle-shimmer {
          0%   { transform: translateX(-150%); }
          100% { transform: translateX(400%); }
        }
        @keyframes idle-dot-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
