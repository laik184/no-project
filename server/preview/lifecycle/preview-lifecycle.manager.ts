/**
 * preview-lifecycle.manager.ts — state machine for one project's preview lifecycle.
 *
 * Emits "preview.lifecycle" onto the global event bus on every transition.
 * The hub pattern in subscription-manager fans it out to all SSE clients.
 *
 * Public API:
 *   manager.transition(state, message, meta?)  — move to a new state
 *   manager.getState()                          — read current state
 *   manager.reset()                             — back to idle
 */

import { bus } from "../../infrastructure/events/bus.ts";
import {
  type PreviewLifecycleState,
  type PreviewLifecycleEvent,
  type LifecycleManagerConfig,
  VALID_TRANSITIONS,
} from "./preview-lifecycle.types.ts";

export class PreviewLifecycleManager {
  private state: PreviewLifecycleState = "idle";
  private projectId: number;

  constructor(config: LifecycleManagerConfig) {
    this.projectId = config.projectId;
  }

  getState(): PreviewLifecycleState {
    return this.state;
  }

  /**
   * Attempt a state transition.
   * Validates against the adjacency list and emits on the bus if allowed.
   * Returns true when the transition was applied.
   */
  transition(
    next:    PreviewLifecycleState,
    message: string,
    meta?:   Record<string, unknown>,
  ): boolean {
    const allowed = VALID_TRANSITIONS[this.state];
    if (!allowed.includes(next)) {
      // Allow force-crash from anywhere — crashes are never invalid
      if (next !== "crashed" && next !== "reconnecting") {
        console.warn(
          `[preview-lifecycle] Invalid transition ${this.state} → ${next} ` +
          `for project ${this.projectId}`,
        );
        return false;
      }
    }

    const prev = this.state;
    this.state  = next;

    const event: PreviewLifecycleEvent = {
      projectId: this.projectId,
      state:     next,
      prevState: prev,
      message,
      meta,
      ts:        Date.now(),
    };

    // Hub fan-out happens in subscription-manager — one bus.on listener
    // delivers to all matching SSE connections.
    bus.emit("preview.lifecycle", event);
    return true;
  }

  /** Force-transition without validation (e.g. external crash signal). */
  forceTransition(
    next:    PreviewLifecycleState,
    message: string,
    meta?:   Record<string, unknown>,
  ): void {
    const prev = this.state;
    this.state  = next;
    bus.emit("preview.lifecycle", {
      projectId: this.projectId,
      state:     next,
      prevState: prev,
      message,
      meta,
      ts:        Date.now(),
    } satisfies PreviewLifecycleEvent);
  }

  reset(): void {
    this.forceTransition("idle", "Project stopped.");
  }
}

// ── Per-project manager registry ─────────────────────────────────────────────

const registry = new Map<number, PreviewLifecycleManager>();

export function getLifecycleManager(projectId: number): PreviewLifecycleManager {
  let mgr = registry.get(projectId);
  if (!mgr) {
    mgr = new PreviewLifecycleManager({ projectId });
    registry.set(projectId, mgr);
  }
  return mgr;
}

export function removeLifecycleManager(projectId: number): void {
  registry.delete(projectId);
}
