/**
 * RealtimeStatusDot — a tiny visual indicator for the shared SSE connection.
 *
 * Shows:
 *   green  (pulse)  — connected
 *   amber  (pulse)  — reconnecting
 *   red    (static) — offline
 *
 * Usage:
 *   import { RealtimeStatusDot } from "@/realtime/RealtimeStatusDot";
 *   <RealtimeStatusDot />                    // default size
 *   <RealtimeStatusDot showLabel />          // with text label
 *   <RealtimeStatusDot size={10} />          // custom dot size in px
 */

import { useRealtime, type RealtimeStatus } from "./realtime-provider";

const CONFIG: Record<RealtimeStatus, { color: string; glow: string; label: string; animate: boolean }> = {
  connected:    { color: "#4ade80", glow: "rgba(74,222,128,0.55)",  label: "Live",         animate: true  },
  reconnecting: { color: "#fbbf24", glow: "rgba(251,191,36,0.55)",  label: "Reconnecting", animate: true  },
  offline:      { color: "#f87171", glow: "rgba(248,113,113,0.35)", label: "Offline",      animate: false },
};

interface RealtimeStatusDotProps {
  /** Dot diameter in px. Default: 6. */
  size?: number;
  /** Show a text label next to the dot. Default: false. */
  showLabel?: boolean;
  /** Extra className on the wrapper span. */
  className?: string;
}

export function RealtimeStatusDot({ size = 6, showLabel = false, className }: RealtimeStatusDotProps) {
  const { status } = useRealtime();
  const { color, glow, label, animate } = CONFIG[status];

  return (
    <span
      className={className}
      title={`Stream: ${label}`}
      style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
    >
      <span
        style={{
          display: "inline-block",
          width: size,
          height: size,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 ${size + 2}px ${glow}`,
          flexShrink: 0,
          animation: animate ? `realtime-pulse 2s ease-in-out infinite` : undefined,
        }}
      />
      {showLabel && (
        <span
          style={{
            fontSize: 11,
            color: color,
            fontWeight: 500,
            letterSpacing: "0.01em",
            lineHeight: 1,
          }}
        >
          {label}
        </span>
      )}
      <style>{`
        @keyframes realtime-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }
      `}</style>
    </span>
  );
}
