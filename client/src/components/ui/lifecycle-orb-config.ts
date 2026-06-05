import type { LifecycleState } from "@/context/lifecycle-context";

/* ── CSS injected once ─────────────────────────────────────────────────── */
export const ORB_CSS = `
  /* dot wave — stagger via nth animation-delay */
  @keyframes dot-scale  { 0%,100%{transform:scale(1)}   45%{transform:scale(1.55)} }
  @keyframes dot-pulse  { 0%,100%{opacity:.55}           45%{opacity:1} }
  @keyframes dot-fast   { 0%,100%{transform:scale(1)}   35%{transform:scale(1.7)} 65%{transform:scale(.85)} }
  @keyframes dot-flash  { 0%,100%{opacity:1}             50%{opacity:.15} }
  @keyframes dot-spin-r { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  @keyframes dot-bounce { 0%,100%{transform:translateY(0)} 45%{transform:translateY(-2.5px)} }
  @keyframes dot-grow   { 0%,100%{transform:scale(1)}   50%{transform:scale(1.4)} }
  @keyframes dot-shake  { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-2px)} 75%{transform:translateX(2px)} }

  /* glow ring around orb */
  @keyframes glow-breathe { 0%,100%{opacity:.4} 50%{opacity:1} }
  @keyframes glow-fast    { 0%,100%{opacity:.5} 30%{opacity:1} }
  @keyframes glow-pop     { 0%{opacity:0;transform:scale(.7)} 45%{opacity:1;transform:scale(1.12)} 100%{opacity:.8;transform:scale(1)} }

  /* left-edge sweep bar */
  @keyframes sweep-bar  { 0%{background-position:0% 0%} 100%{background-position:0% 200%} }
  @keyframes sweep-fast { 0%{background-position:0% 0%} 100%{background-position:0% 200%} }
  @keyframes bar-flash  { 0%,100%{opacity:1} 50%{opacity:.2} }

  .bar-sweep  { animation: sweep-bar  1.8s linear infinite; }
  .bar-fast   { animation: sweep-fast  .9s linear infinite; }
  .bar-flash  { animation: bar-flash   .7s ease-in-out infinite; }
`;

/* ── Per-state config ───────────────────────────────────────────────────── */
export interface DotAnim {
  anim:   string;
  delay:  number;
  color?: string;
}
export interface StateConfig {
  dotColor:  string;
  pathColor: string;
  glow:      string | null;
  glowAnim?: string;
  dot?:      DotAnim;
  barColor:  string[] | null;
  barClass:  string;
}

export const CFG: Record<LifecycleState, StateConfig> = {
  idle: {
    dotColor:  "#6d6f8a",
    pathColor: "#3b3d56",
    glow:      null,
    barColor:  null,
    barClass:  "",
  },
  thinking: {
    dotColor:  "#7c8dff",
    pathColor: "#4f63ff",
    glow:      "0 0 14px #7c8dff55, 0 0 28px #7c8dff20",
    glowAnim:  "glow-breathe 2s ease-in-out infinite",
    dot:       { anim: "dot-scale 2s ease-in-out infinite", delay: 160 },
    barColor:  ["#6c8fff","#a78bfa","#6c8fff","transparent"],
    barClass:  "bar-sweep",
  },
  planning: {
    dotColor:  "#818cf8",
    pathColor: "#4f46e5",
    glow:      "0 0 12px #818cf850",
    glowAnim:  "glow-breathe 2.4s ease-in-out infinite",
    dot:       { anim: "dot-pulse 2.4s ease-in-out infinite", delay: 200 },
    barColor:  ["#7c8dff","#4f63ff","#7c8dff","transparent"],
    barClass:  "bar-sweep",
  },
  delegating: {
    dotColor:  "#a78bfa",
    pathColor: "#7c3aed",
    glow:      "0 0 14px #a78bfa50",
    glowAnim:  "glow-breathe 2s ease-in-out infinite",
    dot:       { anim: "dot-scale 1.8s ease-in-out infinite", delay: 140 },
    barColor:  ["#a78bfa","#7c8dff","#a78bfa","transparent"],
    barClass:  "bar-sweep",
  },
  working: {
    dotColor:  "#c084fc",
    pathColor: "#9333ea",
    glow:      "0 0 18px #c084fc70, 0 0 36px #c084fc30",
    glowAnim:  "glow-fast 1s ease-in-out infinite",
    dot:       { anim: "dot-fast 1s ease-in-out infinite", delay: 90 },
    barColor:  ["#c084fc","#7c8dff","#c084fc","transparent"],
    barClass:  "bar-fast",
  },
  writing: {
    dotColor:  "#34d399",
    pathColor: "#059669",
    glow:      "0 0 14px #34d39960",
    glowAnim:  "glow-breathe 1.4s ease-in-out infinite",
    dot:       { anim: "dot-bounce 1.4s ease-in-out infinite", delay: 120 },
    barColor:  ["#34d399","#6ee7b7","#34d399","transparent"],
    barClass:  "bar-sweep",
  },
  editing: {
    dotColor:  "#6ee7b7",
    pathColor: "#10b981",
    glow:      "0 0 12px #6ee7b750",
    glowAnim:  "glow-breathe 1.8s ease-in-out infinite",
    dot:       { anim: "dot-bounce 1.8s ease-in-out infinite", delay: 150 },
    barColor:  ["#6ee7b7","#34d399","#6ee7b7","transparent"],
    barClass:  "bar-sweep",
  },
  testing: {
    dotColor:  "#fbbf24",
    pathColor: "#d97706",
    glow:      "0 0 14px #fbbf2460",
    glowAnim:  "bar-flash .7s ease-in-out infinite",
    dot:       { anim: "dot-flash .7s ease-in-out infinite", delay: 80 },
    barColor:  ["#fbbf24","#f59e0b","#fbbf24","transparent"],
    barClass:  "bar-flash",
  },
  verifying: {
    dotColor:  "#f59e0b",
    pathColor: "#b45309",
    glow:      "0 0 14px #f59e0b55",
    glowAnim:  "glow-breathe 1.6s ease-in-out infinite",
    dot:       { anim: "dot-scale 1.6s ease-in-out infinite", delay: 130 },
    barColor:  ["#f59e0b","#fbbf24","#f59e0b","transparent"],
    barClass:  "bar-sweep",
  },
  deploying: {
    dotColor:  "#22c55e",
    pathColor: "#16a34a",
    glow:      "0 0 18px #22c55e60, 0 0 36px #22c55e25",
    glowAnim:  "glow-fast 1s ease-in-out infinite",
    dot:       { anim: "dot-grow 1s ease-in-out infinite", delay: 80 },
    barColor:  ["#22c55e","#4ade80","#22c55e","transparent"],
    barClass:  "bar-fast",
  },
  completed: {
    dotColor:  "#4ade80",
    pathColor: "#22c55e",
    glow:      "0 0 20px #4ade8080, 0 0 40px #4ade8030",
    glowAnim:  "glow-pop .6s ease-out both",
    barColor:  ["#4ade80","#22c55e","#4ade80","transparent"],
    barClass:  "",
  },
  failed: {
    dotColor:  "#f87171",
    pathColor: "#ef4444",
    glow:      "0 0 20px #f8717180, 0 0 40px #f8717130",
    glowAnim:  "glow-breathe 1.2s ease-in-out infinite",
    dot:       { anim: "dot-shake .5s ease-in-out 3", delay: 0 },
    barColor:  ["#f87171","#ef4444","#f87171","transparent"],
    barClass:  "",
  },
  cancelled: {
    dotColor:  "#4b5563",
    pathColor: "#374151",
    glow:      "0 0 8px #6b728030",
    barColor:  ["#6b7280","#9ca3af","#6b7280","transparent"],
    barClass:  "",
  },
};

/* ── Dot positions in a 60×60 SVG viewBox ──────────────────────────────── */
export const DOTS: [number, number][] = [
  [8,  8],
  [8,  30],
  [8,  52],
  [30, 30],
  [30, 52],
  [52, 8],
  [52, 30],
  [52, 52],
];

export const PATH = "M30,8 C30,8 50,8 50,30 C50,52 30,52 30,52";

export const STATE_LABEL: Record<LifecycleState, string> = {
  idle: "", thinking: "Thinking", planning: "Planning",
  delegating: "Delegating", working: "Working", writing: "Writing",
  editing: "Editing", testing: "Testing", verifying: "Verifying",
  deploying: "Deploying", completed: "Done", failed: "Failed",
  cancelled: "Cancelled",
};
