/**
 * queue-backpressure.ts
 *
 * Backpressure guard for the memory write queue.
 * Monitors lane depth and enforces throttle / block thresholds.
 *
 * Single responsibility: evaluate and report backpressure state.
 * Does NOT execute writes — only gates them.
 */

import type { QueueKey } from "./memory-types.ts";
import type { BackpressurePolicy, BackpressureState, PolicyDecision } from "./queue.types.ts";

// ── Defaults ──────────────────────────────────────────────────────────────────

export const DEFAULT_BACKPRESSURE_POLICY: BackpressurePolicy = {
  warnDepth:  50,
  blockDepth: 200,
};

// ── Guard ─────────────────────────────────────────────────────────────────────

export class QueueBackpressureGuard {
  private readonly _states  = new Map<QueueKey, BackpressureState>();
  private readonly _policy: BackpressurePolicy;

  constructor(policy: BackpressurePolicy = DEFAULT_BACKPRESSURE_POLICY) {
    this._policy = policy;
  }

  /**
   * Called before enqueuing. Returns a policy decision.
   * Callers must abort if verdict === "block".
   */
  evaluate(queueKey: QueueKey, currentDepth: number): PolicyDecision {
    const state = this._ensureState(queueKey, currentDepth);
    state.depth = currentDepth;

    if (currentDepth >= this._policy.blockDepth) {
      state.isThrottled    = true;
      state.throttledSince = state.throttledSince ?? Date.now();
      return {
        verdict: "block",
        reason:  `Lane "${queueKey}" depth ${currentDepth} exceeds block threshold ${this._policy.blockDepth}`,
        code:    "BACKPRESSURE_BLOCK",
      };
    }

    if (currentDepth >= this._policy.warnDepth) {
      state.isThrottled    = true;
      state.throttledSince = state.throttledSince ?? Date.now();
      return {
        verdict: "throttle",
        reason:  `Lane "${queueKey}" depth ${currentDepth} exceeds warn threshold ${this._policy.warnDepth}`,
        code:    "BACKPRESSURE_THROTTLE",
      };
    }

    // Clear throttle if depth recovered
    if (state.isThrottled) {
      state.isThrottled    = false;
      state.throttledSince = null;
    }

    return { verdict: "allow", reason: "within capacity", code: "OK" };
  }

  /** Snapshot of all tracked lane states. */
  snapshot(): BackpressureState[] {
    return Array.from(this._states.values());
  }

  /** Snapshot for a single lane; null if unseen. */
  laneState(queueKey: QueueKey): BackpressureState | null {
    return this._states.get(queueKey) ?? null;
  }

  /** Remove state for a lane that has been idle long enough to evict. */
  evict(queueKey: QueueKey): void {
    this._states.delete(queueKey);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _ensureState(queueKey: QueueKey, depth: number): BackpressureState {
    let state = this._states.get(queueKey);
    if (!state) {
      state = { queueKey, depth, isThrottled: false, throttledSince: null };
      this._states.set(queueKey, state);
    }
    return state;
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const queueBackpressureGuard = new QueueBackpressureGuard();
