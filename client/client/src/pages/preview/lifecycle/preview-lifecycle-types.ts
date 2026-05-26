/**
 * preview-lifecycle-types.ts — client-side type mirror of the server types.
 * Kept separate so the client bundle never imports server modules.
 *
 * v2: Expanded to 15 states for Replit-level lifecycle granularity.
 *   verifying    — post-start health check window (green checkmark)
 *   hot_reloading— CSS/JS partial update, no full restart (cyan lightning)
 *   self_healing — AI is autonomously fixing a crash (purple brain)
 *   debugging    — AI is reading logs and diagnosing (orange search)
 *   patching     — AI is applying a targeted code patch (violet wrench)
 */

export type PreviewLifecycleState =
  | "idle"
  | "building"
  | "installing"
  | "starting"
  | "verifying"
  | "restarting"
  | "updating"
  | "refreshing"
  | "hot_reloading"
  | "self_healing"
  | "debugging"
  | "patching"
  | "ready"
  | "crashed"
  | "reconnecting";

export interface StateConfig {
  label:       string;
  color:       string;
  showSpinner: boolean;
  showBar:     boolean;
  isError:     boolean;
  icon?:       "spinner" | "crash" | "reconnect" | "verify" | "heal" | "hotreload" | "debug" | "patch";
}

export const STATE_CONFIG: Record<PreviewLifecycleState, StateConfig> = {
  idle:         { label: "Idle",           color: "#6b7280", showSpinner: false, showBar: false, isError: false },
  building:     { label: "Building…",      color: "#7c8dff", showSpinner: true,  showBar: true,  isError: false, icon: "spinner" },
  installing:   { label: "Installing…",    color: "#a78bfa", showSpinner: true,  showBar: true,  isError: false, icon: "spinner" },
  starting:     { label: "Starting…",      color: "#34d399", showSpinner: true,  showBar: true,  isError: false, icon: "spinner" },
  verifying:    { label: "Verifying…",     color: "#a3e635", showSpinner: false, showBar: true,  isError: false, icon: "verify" },
  restarting:   { label: "Restarting…",    color: "#fbbf24", showSpinner: true,  showBar: true,  isError: false, icon: "spinner" },
  updating:     { label: "Updating…",      color: "#38bdf8", showSpinner: true,  showBar: true,  isError: false, icon: "spinner" },
  refreshing:   { label: "Refreshing…",    color: "#34d399", showSpinner: true,  showBar: false, isError: false, icon: "spinner" },
  hot_reloading:{ label: "Hot Reload",     color: "#22d3ee", showSpinner: false, showBar: false, isError: false, icon: "hotreload" },
  self_healing: { label: "Self-Healing…",  color: "#e879f9", showSpinner: true,  showBar: true,  isError: false, icon: "heal" },
  debugging:    { label: "Debugging…",     color: "#fb923c", showSpinner: true,  showBar: false, isError: false, icon: "debug" },
  patching:     { label: "Patching…",      color: "#a78bfa", showSpinner: true,  showBar: true,  isError: false, icon: "patch" },
  ready:        { label: "Ready",          color: "#22c55e", showSpinner: false, showBar: false, isError: false },
  crashed:      { label: "Crashed",        color: "#f87171", showSpinner: false, showBar: false, isError: true,  icon: "crash" },
  reconnecting: { label: "Reconnecting…",  color: "#fb923c", showSpinner: true,  showBar: false, isError: false, icon: "reconnect" },
};
