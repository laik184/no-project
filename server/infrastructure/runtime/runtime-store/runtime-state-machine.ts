/**
 * runtime-store/runtime-state-machine.ts
 *
 * Deterministic state machine for RuntimePhase transitions.
 * Invalid transitions are rejected and logged — never silently applied.
 *
 * Design:
 *   - crashed and reconnecting are always reachable from any phase
 *     (emergency escape hatches — crashes don't respect normal flow)
 *   - idle is reachable from any terminal state (stopped/failed)
 *   - All other transitions follow the project lifecycle DAG
 */

import type { RuntimePhase } from "./runtime-types.ts";

// ─── Adjacency list ───────────────────────────────────────────────────────────

const TRANSITIONS: Record<RuntimePhase, RuntimePhase[]> = {
  idle:         ["building", "installing", "starting", "crashed", "reconnecting"],
  building:     ["installing", "starting", "verifying", "crashed", "idle"],
  installing:   ["building",  "starting",  "crashed",   "idle"],
  starting:     ["verifying", "ready",     "crashed",   "restarting"],
  verifying:    ["ready",     "crashed",   "restarting","recovering"],
  ready:        ["building",  "installing","restarting","updating", "crashed", "idle"],
  updating:     ["ready",     "restarting","crashed"],
  restarting:   ["starting",  "verifying", "ready",    "crashed",  "idle"],
  reconnecting: ["ready",     "starting",  "crashed",  "idle"],
  crashed:      ["recovering","restarting","building",  "idle"],
  recovering:   ["restarting","crashed",   "idle"],
  failed:       ["idle",      "building"],
};

// Phases that are always reachable regardless of current state
const EMERGENCY_TARGETS = new Set<RuntimePhase>(["crashed", "reconnecting", "idle"]);

// ─── Machine ──────────────────────────────────────────────────────────────────

export class RuntimeStateMachine {
  private phase: RuntimePhase;
  private projectId: number;

  constructor(projectId: number, initial: RuntimePhase = "idle") {
    this.projectId = projectId;
    this.phase     = initial;
  }

  current(): RuntimePhase {
    return this.phase;
  }

  /**
   * Attempt a validated transition.
   * Returns true if applied, false if rejected.
   */
  transition(next: RuntimePhase): boolean {
    if (this.phase === next) return true; // idempotent

    const allowed = TRANSITIONS[this.phase];
    if (allowed.includes(next) || EMERGENCY_TARGETS.has(next)) {
      this.phase = next;
      return true;
    }

    console.warn(
      `[runtime-state-machine] Rejected: ${this.phase} → ${next} ` +
      `(project ${this.projectId})`
    );
    return false;
  }

  /**
   * Force-transition without validation.
   * Only use for external authoritative signals (process exit, crash signal).
   */
  force(next: RuntimePhase): void {
    this.phase = next;
  }

  /** Returns the allowed next phases from the current state. */
  allowedTransitions(): RuntimePhase[] {
    return [...TRANSITIONS[this.phase], ...EMERGENCY_TARGETS];
  }
}
