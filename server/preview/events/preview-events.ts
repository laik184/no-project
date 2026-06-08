/**
 * preview-events.ts — preview lifecycle event type definitions.
 * Pure types. No runtime dependencies.
 */

import type { PreviewLifecycleState } from "../domain/entities/preview-state.ts";

export interface PreviewLifecycleEvent {
  readonly type:      "preview.lifecycle";
  readonly projectId: number;
  readonly state:     PreviewLifecycleState;
  readonly prevState: PreviewLifecycleState;
  readonly message:   string;
  readonly meta:      Record<string, unknown>;
  readonly ts:        number;
}

export interface PreviewSessionOpenedEvent {
  readonly type:      "preview.session.opened";
  readonly projectId: number;
  readonly sessionId: string;
  readonly port:      number | null;
  readonly ts:        number;
}

export interface PreviewSessionClosedEvent {
  readonly type:      "preview.session.closed";
  readonly projectId: number;
  readonly sessionId: string;
  readonly ts:        number;
}

export type PreviewEvent =
  | PreviewLifecycleEvent
  | PreviewSessionOpenedEvent
  | PreviewSessionClosedEvent;
