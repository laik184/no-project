/**
 * preview-lifecycle.types.ts — canonical types for the Preview Lifecycle System.
 *
 * 15 discrete states model every phase of a running project.
 * New states added for world-class Replit-level granularity:
 *   verifying    — post-start health check window
 *   self_healing — AI is analyzing and autonomously fixing a crash
 *   hot_reloading— CSS/JS partial update, no full restart needed
 *   debugging    — AI is reading logs and diagnosing the root cause
 *   patching     — AI is applying a targeted code patch
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

export interface PreviewLifecycleEvent {
  projectId: number;
  state:     PreviewLifecycleState;
  prevState: PreviewLifecycleState;
  message:   string;
  meta?:     Record<string, unknown>;
  ts:        number;
}

/** Allowed state → state transitions (adjacency list). */
export const VALID_TRANSITIONS: Record<PreviewLifecycleState, PreviewLifecycleState[]> = {
  idle:         ["building", "installing", "starting", "reconnecting", "self_healing"],
  building:     ["installing", "starting", "verifying", "restarting", "hot_reloading", "crashed", "ready"],
  installing:   ["building", "starting", "verifying", "crashed", "idle"],
  starting:     ["verifying", "ready", "crashed", "restarting"],
  verifying:    ["ready", "crashed", "restarting", "self_healing"],
  restarting:   ["starting", "verifying", "updating", "ready", "crashed"],
  updating:     ["refreshing", "hot_reloading", "ready", "crashed"],
  refreshing:   ["ready", "crashed"],
  hot_reloading:["ready", "crashed", "refreshing"],
  self_healing: ["debugging", "patching", "crashed", "idle", "restarting"],
  debugging:    ["patching", "crashed", "self_healing", "restarting"],
  patching:     ["restarting", "crashed", "idle"],
  ready:        ["building", "installing", "restarting", "updating", "hot_reloading", "crashed", "idle", "self_healing"],
  crashed:      ["restarting", "building", "idle", "reconnecting", "self_healing", "debugging"],
  reconnecting: ["ready", "crashed", "idle"],
};

export interface LifecycleManagerConfig {
  projectId: number;
}
