/**
 * LifecycleOrb.tsx
 *
 * Animated logo indicator that reflects the current agent lifecycle state.
 * - Active states: spinning ring + pulsing glow around the Nura-X logo
 * - Terminal states: colored glow (green/red/gray), no spin, fades to idle
 * - Idle: static logo, no animation
 */
import { useLifecycle, type LifecycleState } from "@/context/lifecycle-context";
import { cn } from "@/lib/utils";

const STATE_COLOR: Record<LifecycleState, string> = {
  idle:       "#4b5563",
  thinking:   "#7c8dff",
  planning:   "#7c8dff",
  delegating: "#a78bfa",
  working:    "#a78bfa",
  writing:    "#c084fc",
  editing:    "#c084fc",
  testing:    "#f59e0b",
  verifying:  "#f59e0b",
  deploying:  "#22c55e",
  completed:  "#22c55e",
  failed:     "#ef4444",
  cancelled:  "#6b7280",
};

const ORB_CSS = `
  @keyframes orb-spin   { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes orb-pulse  { 0%,100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }
  @keyframes orb-glow   { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
  @keyframes orb-enter  { from { opacity: 0; transform: scale(0.88); } to { opacity: 1; transform: scale(1); } }
  @keyframes orb-done   { 0% { transform: scale(1); } 40% { transform: scale(1.12); } 100% { transform: scale(1); } }
  .orb-spin   { animation: orb-spin  2.4s linear infinite; }
  .orb-pulse  { animation: orb-pulse 1.8s ease-in-out infinite; }
  .orb-glow   { animation: orb-glow  2s ease-in-out infinite; }
  .orb-enter  { animation: orb-enter 0.25s cubic-bezier(0.22,1,0.36,1) both; }
  .orb-done   { animation: orb-done  0.45s ease-out both; }
`;

interface LifecycleOrbProps {
  /** Size of the logo image in pixels */
  size?: number;
  /** Show label + description below the orb */
  showLabel?: boolean;
  /** Additional className for the root element */
  className?: string;
}

export function LifecycleOrb({ size = 28, showLabel = false, className }: LifecycleOrbProps) {
  const { state, label, dynamicDescription, isActive } = useLifecycle();
  const color   = STATE_COLOR[state];
  const isTerminal = state === "completed" || state === "failed" || state === "cancelled";
  const ringSize = size + 6;

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <style>{ORB_CSS}</style>

      {/* Orb wrapper */}
      <div
        className={cn(isTerminal && "orb-done")}
        style={{ position: "relative", width: ringSize, height: ringSize, flexShrink: 0 }}
        data-testid="lifecycle-orb"
        data-state={state}
      >
        {/* Spinning ring — visible only when active */}
        {isActive && (
          <div
            className="orb-spin"
            style={{
              position:     "absolute",
              inset:        0,
              borderRadius: Math.round(ringSize * 0.36),
              border:       `1.5px solid transparent`,
              borderTopColor:   color,
              borderRightColor: `${color}60`,
              pointerEvents:    "none",
            }}
          />
        )}

        {/* Glow halo — visible when active or terminal */}
        <div
          className={cn(isActive && "orb-glow")}
          style={{
            position:     "absolute",
            inset:        -2,
            borderRadius: Math.round(ringSize * 0.38),
            boxShadow:    isActive
              ? `0 0 8px ${color}50, 0 0 20px ${color}30`
              : isTerminal
                ? `0 0 12px ${color}60`
                : "none",
            transition:   "box-shadow 0.5s ease",
            pointerEvents: "none",
          }}
        />

        {/* Logo */}
        <div
          style={{
            position:        "absolute",
            inset:           3,
            borderRadius:    Math.round(size * 0.32),
            overflow:        "hidden",
            background:      "#12161e",
            display:         "flex",
            alignItems:      "center",
            justifyContent:  "center",
          }}
        >
          <img
            src="/nura-logo.png"
            alt="Nura-X"
            style={{
              width:      "100%",
              height:     "100%",
              objectFit:  "cover",
              display:    "block",
              filter:     isActive
                ? `drop-shadow(0 0 3px ${color}80)`
                : state === "idle"
                  ? "brightness(0.7) saturate(0.5)"
                  : `drop-shadow(0 0 4px ${color}80)`,
              transition: "filter 0.4s ease",
            }}
          />
        </div>
      </div>

      {/* Label + description */}
      {showLabel && state !== "idle" && (
        <div className="orb-enter flex flex-col items-center gap-0.5 text-center" style={{ maxWidth: 160 }}>
          <span
            className="text-[11px] font-semibold leading-none"
            style={{ color: isTerminal ? color : "#e5e7eb" }}
          >
            {label}
          </span>
          {dynamicDescription && (
            <span
              className="text-[9px] leading-tight truncate w-full"
              style={{ color: "rgba(148,163,184,0.65)" }}
            >
              {dynamicDescription}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
