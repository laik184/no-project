/**
 * server/quantum/scheduler/backpressure-controller.ts
 *
 * Monitors pool saturation and issues accept/throttle/reject decisions.
 * Prevents unbounded execution by gating task admission at the scheduler level.
 *
 * Saturation tiers
 * ────────────────
 *   < threshold       → accept  (normal operation)
 *   threshold–0.95    → throttle (emit warning, accept with delay hint)
 *   ≥ 0.95            → reject  (emit overflow, refuse task)
 */

import type { BackpressureDecision, SchedulerConfig } from "./worker-types.ts";

// ── Configuration ─────────────────────────────────────────────────────────────

const HARD_REJECT_RATIO  = 0.95;   // above this → always reject
const COOLDOWN_BASE_MS   = 100;    // base throttle cooldown hint

// ── Backpressure state ────────────────────────────────────────────────────────

interface BackpressureState {
  lastRejectAt:   number;
  lastSaturation: number;
  consecutiveOverloads: number;
}

// ── Controller ────────────────────────────────────────────────────────────────

class BackpressureController {
  private config: Pick<SchedulerConfig, "maxConcurrency" | "maxQueueSize" | "saturationThreshold"> = {
    maxConcurrency:      20,
    maxQueueSize:        200,
    saturationThreshold: 0.8,
  };

  private state: BackpressureState = {
    lastRejectAt:         0,
    lastSaturation:       0,
    consecutiveOverloads: 0,
  };

  configure(cfg: typeof this.config): void {
    this.config = cfg;
  }

  /**
   * Evaluate whether a new task should be accepted, throttled, or rejected.
   *
   * @param active    - currently executing task count
   * @param queueSize - current pending queue depth
   */
  evaluate(active: number, queueSize: number): BackpressureDecision {
    const workerRatio = this.config.maxConcurrency > 0
      ? active / this.config.maxConcurrency
      : 1;
    const queueRatio  = this.config.maxQueueSize > 0
      ? queueSize / this.config.maxQueueSize
      : 1;

    const saturation = Math.max(workerRatio, queueRatio);
    this.state.lastSaturation = saturation;

    if (saturation >= HARD_REJECT_RATIO) {
      this.state.lastRejectAt = Date.now();
      this.state.consecutiveOverloads++;
      return "reject";
    }

    if (saturation >= this.config.saturationThreshold) {
      this.state.consecutiveOverloads++;
      return "throttle";
    }

    this.state.consecutiveOverloads = 0;
    return "accept";
  }

  /** Whether the pool is currently under backpressure (throttle or reject). */
  isSaturated(): boolean {
    return this.state.lastSaturation >= this.config.saturationThreshold;
  }

  /** Suggested cooldown delay in ms for throttled tasks. Scales with overload count. */
  throttleCooldownMs(): number {
    return Math.min(5_000, COOLDOWN_BASE_MS * Math.pow(2, this.state.consecutiveOverloads));
  }

  /** Returns the last measured saturation ratio (0–1). */
  saturationRatio(): number {
    return this.state.lastSaturation;
  }

  /** Returns count of consecutive overload events (for escalating alerts). */
  consecutiveOverloadCount(): number {
    return this.state.consecutiveOverloads;
  }

  snapshot() {
    return {
      saturation:           this.state.lastSaturation,
      consecutiveOverloads: this.state.consecutiveOverloads,
      lastRejectAt:         this.state.lastRejectAt,
      isSaturated:          this.isSaturated(),
    };
  }
}

export const backpressureController = new BackpressureController();
