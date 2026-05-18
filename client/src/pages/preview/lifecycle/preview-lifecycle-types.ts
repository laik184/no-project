/**
 * preview-lifecycle-types.ts — client-side type mirror of the server types.
 * Kept separate so the client bundle never imports server modules.
 */

export type PreviewLifecycleState =
  | "idle"
  | "building"
  | "installing"
  | "starting"
  | "restarting"
  | "updating"
  | "refreshing"
  | "ready"
  | "crashed"
  | "reconnecting";

export const STATE_CONFIG: Record<
  PreviewLifecycleState,
  { label: string; color: string; showSpinner: boolean; showBar: boolean; isError: boolean }
> = {
  idle:         { label: "Idle",         color: "#6b7280", showSpinner: false, showBar: false, isError: false },
  building:     { label: "Building…",    color: "#7c8dff", showSpinner: true,  showBar: true,  isError: false },
  installing:   { label: "Installing…",  color: "#a78bfa", showSpinner: true,  showBar: true,  isError: false },
  starting:     { label: "Starting…",    color: "#34d399", showSpinner: true,  showBar: true,  isError: false },
  restarting:   { label: "Restarting…",  color: "#fbbf24", showSpinner: true,  showBar: true,  isError: false },
  updating:     { label: "Updating…",    color: "#38bdf8", showSpinner: true,  showBar: true,  isError: false },
  refreshing:   { label: "Refreshing…",  color: "#34d399", showSpinner: true,  showBar: false, isError: false },
  ready:        { label: "Ready",        color: "#22c55e", showSpinner: false, showBar: false, isError: false },
  crashed:      { label: "Crashed",      color: "#f87171", showSpinner: false, showBar: false, isError: true  },
  reconnecting: { label: "Reconnecting…",color: "#fb923c", showSpinner: true,  showBar: false, isError: false },
};
