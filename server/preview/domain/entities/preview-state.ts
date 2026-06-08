/**
 * preview-state.ts — PreviewState domain entity.
 * Represents the persisted lifecycle state for a project's preview.
 * Immutable value object.
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

export interface PreviewState {
  readonly projectId:  number;
  readonly state:      PreviewLifecycleState;
  readonly prevState:  PreviewLifecycleState;
  readonly message:    string;
  readonly meta:       Record<string, unknown>;
  readonly ts:         number;
}

export function createPreviewState(projectId: number): PreviewState {
  return Object.freeze({
    projectId,
    state:    "idle",
    prevState: "idle",
    message:  "Preview initialized.",
    meta:     {},
    ts:       Date.now(),
  });
}

export function transitionPreviewState(
  current:  PreviewState,
  next:     PreviewLifecycleState,
  message:  string,
  meta:     Record<string, unknown> = {},
): PreviewState {
  return Object.freeze({
    ...current,
    prevState: current.state,
    state:     next,
    message,
    meta,
    ts:        Date.now(),
  });
}
