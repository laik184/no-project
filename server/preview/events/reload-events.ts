/**
 * reload-events.ts — reload event type definitions.
 * Pure types. No runtime dependencies.
 */

export type ReloadType = "soft" | "hard" | "hot" | "server-restart";

export interface ReloadRequestedEvent {
  readonly type:       "reload.requested";
  readonly projectId:  number;
  readonly reloadType: ReloadType;
  readonly reason:     string;
  readonly ts:         number;
}

export interface ReloadCompletedEvent {
  readonly type:       "reload.completed";
  readonly projectId:  number;
  readonly reloadType: ReloadType;
  readonly ts:         number;
}

export interface HotReloadEvent {
  readonly type:       "reload.hot";
  readonly projectId:  number;
  readonly changedFiles: string[];
  readonly ts:         number;
}

export type ReloadEvent =
  | ReloadRequestedEvent
  | ReloadCompletedEvent
  | HotReloadEvent;
