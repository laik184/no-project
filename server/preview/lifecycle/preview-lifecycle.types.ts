/**
 * preview-lifecycle.types.ts — canonical types for the Preview Lifecycle System.
 *
 * Ten discrete states model every phase of a running project.
 * Each transition carries a structured payload so the frontend
 * can render the right animation without polling.
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

export interface PreviewLifecycleEvent {
  projectId: number;
  /** New state after the transition. */
  state:     PreviewLifecycleState;
  /** Previous state — lets the client animate from→to correctly. */
  prevState: PreviewLifecycleState;
  /** Human-readable status line shown in the overlay. */
  message:   string;
  /** Optional structured metadata (port, exitCode, file path, etc.). */
  meta?:     Record<string, unknown>;
  ts:        number;
}

/** Allowed state → state transitions (adjacency list). */
export const VALID_TRANSITIONS: Record<PreviewLifecycleState, PreviewLifecycleState[]> = {
  idle:         ["building", "installing", "starting", "reconnecting"],
  building:     ["installing", "starting", "restarting", "crashed", "ready"],
  installing:   ["building", "starting", "crashed", "idle"],
  starting:     ["ready", "crashed", "restarting"],
  restarting:   ["starting", "updating", "ready", "crashed"],
  updating:     ["refreshing", "ready", "crashed"],
  refreshing:   ["ready", "crashed"],
  ready:        ["building", "installing", "restarting", "updating", "crashed", "idle"],
  crashed:      ["restarting", "building", "idle", "reconnecting"],
  reconnecting: ["ready", "crashed", "idle"],
};

export interface LifecycleManagerConfig {
  projectId: number;
}
