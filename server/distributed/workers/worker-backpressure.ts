/**
 * Responsibility: Backpressure control for the CentralWorkerPool — detects saturation
 *                 per tier, enforces admission limits, and emits pressure events.
 * Dependencies: worker-capacity, bus
 * Failure: isAdmissionAllowed returns false on any error (fail-closed).
 * Telemetry: emits worker.backpressure when saturation threshold crossed.
 */

import { workerCapacity } from "./worker-capacity.ts";
import { bus }            from "../../infrastructure/events/bus.ts";
import type { WorkerTier } from "./types/index.ts";

const SATURATION_THRESHOLD_PCT = 90;
const ADMISSION_QUEUE_LIMIT    = 50;

class WorkerBackpressure {
  private readonly pendingCounts = new Map<WorkerTier, number>();

  isAdmissionAllowed(tier: WorkerTier): boolean {
    try {
      const snap    = workerCapacity.snapshot(tier);
      const pending = this.pendingCounts.get(tier) ?? 0;
      if (snap.utilizationPct >= SATURATION_THRESHOLD_PCT && pending >= ADMISSION_QUEUE_LIMIT) {
        this.emitBackpressure(tier, snap.utilizationPct, pending);
        return false;
      }
      return true;
    } catch { return false; }
  }

  onAdmit(tier: WorkerTier): void {
    this.pendingCounts.set(tier, (this.pendingCounts.get(tier) ?? 0) + 1);
  }

  onComplete(tier: WorkerTier): void {
    const cur = this.pendingCounts.get(tier) ?? 0;
    this.pendingCounts.set(tier, Math.max(0, cur - 1));
  }

  pressure(): Record<WorkerTier, { pct: number; pending: number }> {
    const tiers: WorkerTier[] = ["io-bound", "cpu-bound", "llm"];
    return Object.fromEntries(
      tiers.map(t => [t, {
        pct:     workerCapacity.snapshot(t).utilizationPct,
        pending: this.pendingCounts.get(t) ?? 0,
      }])
    ) as Record<WorkerTier, { pct: number; pending: number }>;
  }

  private emitBackpressure(tier: WorkerTier, pct: number, pending: number): void {
    try {
      bus.emit("agent.event", {
        runId: "system", projectId: 0,
        phase: "distributed.worker",
        agentName: "worker-backpressure",
        eventType: "worker.backpressure",
        payload: { tier, utilizationPct: pct, pendingCount: pending },
        ts: Date.now(),
      });
    } catch { /* non-throwing */ }
  }
}

export const workerBackpressure = new WorkerBackpressure();
