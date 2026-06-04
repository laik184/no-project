/**
 * LifecycleOrb.tsx
 *
 * Animated logo indicator with a unique animation per lifecycle state.
 *
 * idle        — static, dimmed
 * thinking    — slow breathing pulse, blue glow
 * planning    — single rotating dashed ring, blue
 * delegating  — two rings counter-rotating, purple
 * working     — fast solid spinning ring, violet, bright glow
 * writing     — gentle bounce + green shimmer
 * testing     — amber flash blink
 * verifying   — dual rings + amber glow
 * deploying   — ripple expand rings, green
 * completed   — green burst + static success glow
 * failed      — red shake + red glow
 * cancelled   — grey fade pulse
 */

import { useLifecycle, type LifecycleState } from "@/context/lifecycle-context";

const ORB_CSS = `
  /* ── base ── */
  @keyframes orb-breathe   { 0%,100%{transform:scale(1);opacity:.85} 50%{transform:scale(1.07);opacity:1} }
  @keyframes orb-bounce    { 0%,100%{transform:translateY(0)} 40%{transform:translateY(-3px)} 70%{transform:translateY(-1px)} }
  @keyframes orb-shake     { 0%,100%{transform:rotate(0)} 20%{transform:rotate(-7deg)} 40%{transform:rotate(7deg)} 60%{transform:rotate(-5deg)} 80%{transform:rotate(4deg)} }
  @keyframes orb-pop       { 0%{transform:scale(1)} 35%{transform:scale(1.15)} 65%{transform:scale(.96)} 100%{transform:scale(1)} }

  /* ── rings ── */
  @keyframes ring-cw       { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes ring-ccw      { from{transform:rotate(0deg)} to{transform:rotate(-360deg)} }
  @keyframes ring-ripple   { 0%{transform:scale(1);opacity:.9} 100%{transform:scale(2.2);opacity:0} }
  @keyframes ring-flash    { 0%,100%{opacity:1} 50%{opacity:.12} }

  /* ── glow ── */
  @keyframes glow-pulse    { 0%,100%{opacity:.5} 50%{opacity:1} }
  @keyframes glow-success  { 0%{opacity:0;transform:scale(.8)} 40%{opacity:1;transform:scale(1.1)} 100%{opacity:.7;transform:scale(1)} }

  /* ── label dots ── */
  @keyframes dot-wave { 0%,80%,100%{transform:scale(.5);opacity:.3} 40%{transform:scale(1);opacity:1} }
  .dot1 { animation: dot-wave 1.4s ease-in-out 0ms   infinite; }
  .dot2 { animation: dot-wave 1.4s ease-in-out 180ms infinite; }
  .dot3 { animation: dot-wave 1.4s ease-in-out 360ms infinite; }
`;

/* ── per-state visual config ── */
interface StateVisual {
  color:        string;
  glow:         string;
  logoAnim?:    string;
  ring1?:       { border: string; anim: string; inset: number };
  ring2?:       { border: string; anim: string; inset: number };
  ripple?:      boolean;
  glowAnim?:    string;
  logoFilter?:  string;
  dots?:        boolean;
}

const VISUAL: Record<LifecycleState, StateVisual> = {
  idle: {
    color:       "#4b5563",
    glow:        "none",
    logoFilter:  "brightness(.55) saturate(.4)",
  },

  thinking: {
    color:       "#6c8fff",
    glow:        "0 0 14px #6c8fff55, 0 0 32px #6c8fff25",
    logoAnim:    "orb-breathe 2.2s ease-in-out infinite",
    glowAnim:    "glow-pulse 2.2s ease-in-out infinite",
    logoFilter:  "drop-shadow(0 0 6px #6c8fff90)",
    dots:        true,
  },

  planning: {
    color:       "#7c8dff",
    glow:        "0 0 12px #7c8dff50, 0 0 28px #7c8dff20",
    logoAnim:    "orb-breathe 2.8s ease-in-out infinite",
    ring1:       { border: "1.5px dashed #7c8dff90", anim: "ring-cw 3s linear infinite", inset: -5 },
    glowAnim:    "glow-pulse 2.8s ease-in-out infinite",
    logoFilter:  "drop-shadow(0 0 5px #7c8dff80)",
  },

  delegating: {
    color:       "#a78bfa",
    glow:        "0 0 14px #a78bfa60, 0 0 30px #a78bfa20",
    ring1:       { border: "1.5px solid #a78bfa80", anim: "ring-cw 2.2s linear infinite",  inset: -5 },
    ring2:       { border: "1px dashed #a78bfa50",  anim: "ring-ccw 3.5s linear infinite", inset: -11 },
    glowAnim:    "glow-pulse 2.2s ease-in-out infinite",
    logoFilter:  "drop-shadow(0 0 5px #a78bfa80)",
  },

  working: {
    color:       "#c084fc",
    glow:        "0 0 16px #c084fc70, 0 0 36px #c084fc30",
    ring1:       { border: "2px solid #c084fc", anim: "ring-cw 1s linear infinite", inset: -5 },
    glowAnim:    "glow-pulse 1s ease-in-out infinite",
    logoFilter:  "drop-shadow(0 0 7px #c084fcaa)",
    dots:        true,
  },

  writing: {
    color:       "#34d399",
    glow:        "0 0 12px #34d39950, 0 0 26px #34d39920",
    logoAnim:    "orb-bounce 1.2s ease-in-out infinite",
    ring1:       { border: "1.5px solid #34d39970", anim: "ring-cw 2.4s linear infinite", inset: -5 },
    glowAnim:    "glow-pulse 1.2s ease-in-out infinite",
    logoFilter:  "drop-shadow(0 0 5px #34d39980) hue-rotate(90deg) saturate(1.3)",
  },

  editing: {
    color:       "#6ee7b7",
    glow:        "0 0 12px #6ee7b750",
    logoAnim:    "orb-bounce 1.5s ease-in-out infinite",
    ring1:       { border: "1.5px dashed #6ee7b780", anim: "ring-cw 2s linear infinite", inset: -5 },
    glowAnim:    "glow-pulse 1.5s ease-in-out infinite",
    logoFilter:  "drop-shadow(0 0 4px #6ee7b780)",
  },

  testing: {
    color:       "#fbbf24",
    glow:        "0 0 14px #fbbf2460, 0 0 30px #fbbf2420",
    ring1:       { border: "2px solid #fbbf24", anim: "ring-flash 0.7s ease-in-out infinite", inset: -5 },
    glowAnim:    "ring-flash 0.7s ease-in-out infinite",
    logoFilter:  "drop-shadow(0 0 6px #fbbf2499) sepia(.4) saturate(2)",
  },

  verifying: {
    color:       "#f59e0b",
    glow:        "0 0 14px #f59e0b55, 0 0 28px #f59e0b20",
    ring1:       { border: "1.5px solid #f59e0b90", anim: "ring-cw 1.8s linear infinite",  inset: -5  },
    ring2:       { border: "1px dashed #f59e0b55",  anim: "ring-ccw 2.8s linear infinite", inset: -11 },
    glowAnim:    "glow-pulse 1.8s ease-in-out infinite",
    logoFilter:  "drop-shadow(0 0 6px #f59e0baa)",
  },

  deploying: {
    color:       "#22c55e",
    glow:        "0 0 16px #22c55e60, 0 0 36px #22c55e25",
    ring1:       { border: "2px solid #22c55e90", anim: "ring-cw 1.5s linear infinite",          inset: -5  },
    ring2:       { border: "1px solid #22c55e40", anim: "ring-ripple 1.5s ease-out infinite .6s", inset: -11 },
    glowAnim:    "glow-pulse 1.5s ease-in-out infinite",
    logoFilter:  "drop-shadow(0 0 8px #22c55eaa)",
    dots:        true,
  },

  completed: {
    color:       "#4ade80",
    glow:        "0 0 20px #4ade8080, 0 0 40px #4ade8030",
    logoAnim:    "orb-pop .5s ease-out both",
    glowAnim:    "glow-success .6s ease-out both",
    logoFilter:  "drop-shadow(0 0 10px #4ade80cc)",
  },

  failed: {
    color:       "#f87171",
    glow:        "0 0 20px #f8717180, 0 0 40px #f8717130",
    logoAnim:    "orb-shake .5s ease-in-out 3",
    glowAnim:    "glow-pulse 1.2s ease-in-out infinite",
    logoFilter:  "drop-shadow(0 0 10px #f87171cc) saturate(1.5)",
  },

  cancelled: {
    color:       "#6b7280",
    glow:        "0 0 10px #6b728040",
    logoAnim:    "orb-breathe 3s ease-in-out infinite",
    glowAnim:    "glow-pulse 3s ease-in-out infinite",
    logoFilter:  "brightness(.5) saturate(.2)",
  },
};

const STATE_LABEL: Record<LifecycleState, string> = {
  idle:       "",
  thinking:   "Thinking",
  planning:   "Planning",
  delegating: "Delegating",
  working:    "Working",
  writing:    "Writing",
  editing:    "Editing",
  testing:    "Testing",
  verifying:  "Verifying",
  deploying:  "Deploying",
  completed:  "Done",
  failed:     "Failed",
  cancelled:  "Cancelled",
};

const DOTS_STATES: LifecycleState[] = ["thinking", "working", "deploying"];

interface LifecycleOrbProps {
  size?:       number;
  showLabel?:  boolean;
  className?:  string;
}

export function LifecycleOrb({ size = 28, showLabel = false, className }: LifecycleOrbProps) {
  const { state, dynamicDescription } = useLifecycle();
  const v = VISUAL[state];
  const ringSize = size + 10;
  const ring2Size = size + 22;
  const isActive = state !== "idle" && state !== "completed" && state !== "failed" && state !== "cancelled";
  const isTerminal = state === "completed" || state === "failed" || state === "cancelled";
  const showDots = DOTS_STATES.includes(state);

  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <style>{ORB_CSS}</style>

      {/* ── Orb container ── */}
      <div style={{ position: "relative", width: ringSize, height: ringSize, flexShrink: 0 }}
        data-testid="lifecycle-orb" data-state={state}>

        {/* Glow halo */}
        <div style={{
          position: "absolute", inset: -4,
          borderRadius: Math.round((ringSize + 8) * 0.38),
          boxShadow: v.glow,
          animation: v.glowAnim,
          pointerEvents: "none",
          transition: "box-shadow 0.6s ease",
        }} />

        {/* Outer ring (ring2) */}
        {v.ring2 && (
          <div style={{
            position:     "absolute",
            inset:        v.ring2.inset,
            borderRadius: Math.round(ring2Size * 0.36),
            border:       v.ring2.border,
            animation:    v.ring2.anim,
            pointerEvents: "none",
          }} />
        )}

        {/* Inner ring (ring1) */}
        {v.ring1 && (
          <div style={{
            position:     "absolute",
            inset:        v.ring1.inset,
            borderRadius: Math.round(ringSize * 0.36),
            border:       v.ring1.border,
            animation:    v.ring1.anim,
            pointerEvents: "none",
          }} />
        )}

        {/* Logo */}
        <div style={{
          position: "absolute", inset: 5,
          borderRadius: Math.round(size * 0.3),
          overflow: "hidden",
          background: "#0f1318",
          animation: v.logoAnim,
        }}>
          <img
            src="/nura-logo.png"
            alt="Nura-X"
            style={{
              width: "100%", height: "100%",
              objectFit: "cover", display: "block",
              filter: v.logoFilter ?? "none",
              transition: "filter 0.5s ease",
            }}
          />
        </div>

        {/* Terminal state colour overlay (thin ring) */}
        {isTerminal && (
          <div style={{
            position: "absolute", inset: 3,
            borderRadius: Math.round(size * 0.35),
            border: `2px solid ${v.color}60`,
            pointerEvents: "none",
          }} />
        )}
      </div>

      {/* ── Status label ── */}
      {showLabel && state !== "idle" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, maxWidth: 140 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
              color: isTerminal ? v.color : "#e2e8f0",
              transition: "color 0.4s",
            }}>
              {STATE_LABEL[state]}
            </span>
            {showDots && (
              <span style={{ display: "flex", alignItems: "flex-end", gap: 2, paddingBottom: 1 }}>
                {[0,1,2].map(i => (
                  <span key={i} className={`dot${i+1}`} style={{
                    display: "inline-block", width: 3, height: 3,
                    borderRadius: "50%", background: v.color,
                  }} />
                ))}
              </span>
            )}
          </div>
          {dynamicDescription && !isTerminal && (
            <span style={{
              fontSize: 9, color: "rgba(148,163,184,0.6)",
              whiteSpace: "nowrap", overflow: "hidden",
              textOverflow: "ellipsis", maxWidth: 130,
            }}>
              {dynamicDescription}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
