/**
 * Responsibility: Tracks real-time worker capacity per tier — busy/idle ratios,
 *                 saturation detection, and utilization metrics.
 * Dependencies: worker-registry
 * Failure: returns safe defaults on registry error; never throws.
 * Telemetry: snapshot() exposed to CentralWorkerPool and health APIs.
 */

import { workerRegistry }               from "./worker-registry.ts";
import type { WorkerTier, WorkerCapacitySnapshot, CentralWorkerStats } from "./types/index.ts";

const TIER_LIMITS: Record<WorkerTier, number> = {
  "io-bound":  20,
  "cpu-bound":  4,
  "llm":        5,
};

class WorkerCapacity {
  snapshot(tier: WorkerTier): WorkerCapacitySnapshot {
    try {
      const all     = workerRegistry.all().filter(w => w.type === tier);
      const idle    = all.filter(w => w.status === "idle").length;
      const busy    = all.filter(w => w.status === "busy").length;
      const failed  = all.filter(w => w.status === "failed" || w.status === "terminated").length;
      const total   = all.length;
      const limit   = TIER_LIMITS[tier];
      const utilizationPct = total > 0 ? Math.round((busy / total) * 100) : 0;
      return { tier, total, idle, busy, failed, saturated: busy >= limit, utilizationPct };
    } catch {
      return { tier, total: 0, idle: 0, busy: 0, failed: 0, saturated: false, utilizationPct: 0 };
    }
  }

  all(): CentralWorkerStats {
    const tiers = {
      "io-bound":  this.snapshot("io-bound"),
      "cpu-bound": this.snapshot("cpu-bound"),
      "llm":       this.snapshot("llm"),
    };
    const totalActive = Object.values(tiers).reduce((s, t) => s + t.busy, 0);
    const totalIdle   = Object.values(tiers).reduce((s, t) => s + t.idle, 0);
    const totalSlots  = Object.values(tiers).reduce((s, t) => s + TIER_LIMITS[t.tier], 0);
    return { tiers, totalActive, totalIdle, pressure: Math.round((totalActive / totalSlots) * 100) };
  }

  hasCapacity(tier: WorkerTier): boolean {
    const snap = this.snapshot(tier);
    return snap.idle > 0 || snap.total < TIER_LIMITS[tier];
  }

  limits(): Record<WorkerTier, number> { return { ...TIER_LIMITS }; }
}

export const workerCapacity = new WorkerCapacity();
