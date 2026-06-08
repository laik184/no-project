/**
 * runtime-events.ts — runtime process event type definitions.
 * Pure types. No runtime dependencies.
 */

import type { RuntimeStatus } from "../domain/entities/runtime-health.ts";

export interface RuntimeStartedEvent {
  readonly type:      "runtime.started";
  readonly projectId: number;
  readonly pid:       number | null;
  readonly port:      number | null;
  readonly ts:        number;
}

export interface RuntimeStoppedEvent {
  readonly type:      "runtime.stopped";
  readonly projectId: number;
  readonly exitCode:  number | null;
  readonly ts:        number;
}

export interface RuntimeCrashedEvent {
  readonly type:      "runtime.crashed";
  readonly projectId: number;
  readonly exitCode:  number | null;
  readonly reason:    string;
  readonly ts:        number;
}

export interface RuntimeHealthCheckedEvent {
  readonly type:      "runtime.health.checked";
  readonly projectId: number;
  readonly healthy:   boolean;
  readonly status:    RuntimeStatus;
  readonly port:      number | null;
  readonly ts:        number;
}

export type RuntimeEvent =
  | RuntimeStartedEvent
  | RuntimeStoppedEvent
  | RuntimeCrashedEvent
  | RuntimeHealthCheckedEvent;
