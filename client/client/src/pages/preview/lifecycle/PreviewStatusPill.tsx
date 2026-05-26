/**
 * PreviewStatusPill.tsx — compact status indicator for the browser bar.
 *
 * v2: Expanded for all 15 lifecycle states.
 * Shows a colored dot + label that animates on every state transition.
 */

import { STATE_CONFIG } from "./preview-lifecycle-types";
import type { PreviewLifecycleState } from "./preview-lifecycle-types";
import "./lifecycle-animations.css";

interface Props {
  state: PreviewLifecycleState;
}

const PULSING_STATES = new Set<PreviewLifecycleState>([
  "building", "installing", "starting", "verifying",
  "restarting", "updating", "refreshing",
  "self_healing", "debugging", "patching",
  "reconnecting",
]);

// Hot reload is special — brief cyan flash, no pulse dot
const HOT_STATES = new Set<PreviewLifecycleState>(["hot_reloading"]);

export function PreviewStatusPill({ state }: Props) {
  const cfg     = STATE_CONFIG[state];
  const pulsing = PULSING_STATES.has(state);
  const isHot   = HOT_STATES.has(state);

  if (state === "idle") return null;

  return (
    <div
      className="plc-status-pill"
      data-testid={`status-pill-${state}`}
      title={cfg.label}
      style={{
        color:       cfg.color,
        borderColor: isHot ? `${cfg.color}44` : undefined,
        background:  isHot ? `${cfg.color}10` : undefined,
        animation:   isHot ? "plc-card-in 0.15s ease" : undefined,
      }}
    >
      <span
        className={`plc-status-dot${pulsing ? " pulsing" : ""}`}
        style={{ background: cfg.color }}
      />
      {cfg.label}
    </div>
  );
}
