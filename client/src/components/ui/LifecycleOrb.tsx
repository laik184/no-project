/**
 * LifecycleOrb — animated SVG Nura-X logo with per-state dot animations.
 */

import { useLifecycle } from "@/context/lifecycle-context";
import { ORB_CSS, CFG, DOTS, PATH, STATE_LABEL } from "./lifecycle-orb-config";

/* ── Component ──────────────────────────────────────────────────────────── */
interface LifecycleOrbProps {
  size?:      number;
  showLabel?: boolean;
  className?: string;
}

export function LifecycleOrb({ size = 32, showLabel = false, className }: LifecycleOrbProps) {
  const { state, dynamicDescription } = useLifecycle();
  const cfg = CFG[state];
  const dotR = 7;            /* dot radius in SVG units */
  const isActive = !["idle","completed","failed","cancelled"].includes(state);
  const isTerminal = ["completed","failed","cancelled"].includes(state);

  return (
    <div className={className} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
      <style>{ORB_CSS}</style>

      {/* glow halo */}
      <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
        <div style={{
          position:"absolute", inset:-6,
          borderRadius: size * 0.34,
          boxShadow: cfg.glow ?? "none",
          animation: cfg.glowAnim,
          pointerEvents:"none",
          transition:"box-shadow .5s ease",
        }} />

        {/* SVG logo */}
        <svg
          viewBox="0 0 60 60"
          width={size} height={size}
          style={{
            display:"block",
            borderRadius: size * 0.28,
            background: "#111318",
            overflow:"visible",
            filter: state === "idle" ? "brightness(.55) saturate(.3)" : "none",
            transition: "filter .5s ease",
          }}
          data-testid="lifecycle-orb"
          data-state={state}
        >
          {/* S-curve path */}
          <path
            d={PATH}
            stroke={cfg.pathColor}
            strokeWidth={12}
            strokeLinecap="round"
            fill="none"
            style={{ transition:"stroke .4s ease" }}
          />

          {/* Dots */}
          {DOTS.map(([cx, cy], i) => {
            const delay = cfg.dot ? `${i * cfg.dot.delay}ms` : "0ms";
            return (
              <circle
                key={i}
                cx={cx} cy={cy} r={dotR}
                fill={cfg.dotColor}
                style={{
                  transformOrigin:`${cx}px ${cy}px`,
                  animation: cfg.dot ? `${cfg.dot.anim.replace("infinite", "infinite")}` : "none",
                  animationDelay: delay,
                  transition:"fill .4s ease",
                }}
              />
            );
          })}

          {/* terminal ring overlay */}
          {isTerminal && (
            <rect
              x={2} y={2} width={56} height={56}
              rx={14} ry={14}
              fill="none"
              stroke={cfg.dotColor}
              strokeWidth={2.5}
              strokeOpacity={0.5}
            />
          )}
        </svg>
      </div>

      {/* Label strip */}
      {showLabel && state !== "idle" && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
          <span style={{
            fontSize:10, fontWeight:700, letterSpacing:"0.05em",
            color: cfg.dotColor,
            transition:"color .4s ease",
          }}>
            {STATE_LABEL[state]}
          </span>
          {dynamicDescription && !isTerminal && (
            <span style={{
              fontSize:9, color:"rgba(148,163,184,.55)",
              whiteSpace:"nowrap", overflow:"hidden",
              textOverflow:"ellipsis", maxWidth:120,
            }}>
              {dynamicDescription}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
