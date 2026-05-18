/**
 * PreviewStatusPill.tsx — compact status indicator for the browser bar.
 *
 * Shows a colored dot + label that animates on every state transition.
 * Designed to sit inside BrowserBar without adding complexity there.
 */

import { STATE_CONFIG } from "./preview-lifecycle-types";
import type { PreviewLifecycleState } from "./preview-lifecycle-types";
import "./lifecycle-animations.css";

interface Props {
  state: PreviewLifecycleState;
}

const PULSING_STATES = new Set<PreviewLifecycleState>([
  "building", "installing", "starting", "restarting",
  "updating", "refreshing", "reconnecting",
]);

export function PreviewStatusPill({ state }: Props) {
  const cfg     = STATE_CONFIG[state];
  const pulsing = PULSING_STATES.has(state);

  if (state === "idle") return null;

  return (
    <div
      className="plc-status-pill"
      title={cfg.label}
      style={{ color: cfg.color }}
    >
      <span
        className={`plc-status-dot${pulsing ? " pulsing" : ""}`}
        style={{ background: cfg.color }}
      />
      {cfg.label}
    </div>
  );
}
