/**
 * Responsibility: Failure policy decisions for worker slots — retry, revive, or terminate.
 *                 Determines whether a failed worker should be recovered or decommissioned.
 * Dependencies: worker-registry, worker-slot
 * Failure: policy decisions are pure + deterministic; never throws.
 * Telemetry: callers emit distributed.recovery / worker.failed based on policy outcome.
 */

import { WorkerSlot, reviveSlot, WorkerType } from "./worker-slot.ts";
import { workerRegistry }                      from "./worker-registry.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type FailureDecision = "revive" | "replace" | "terminate";

export interface FailurePolicyOptions {
  maxReviveAttempts?: number;
  reviveCooldownMs?:  number;
  type?:              WorkerType;
}

// ── Default policy config ─────────────────────────────────────────────────────

const DEFAULT_MAX_REVIVE  = 2;
const REVIVE_COOLDOWN_MS  = 3_000;

// ── Policy ────────────────────────────────────────────────────────────────────

class WorkerFailurePolicy {
  private reviveTimestamps = new Map<string, number[]>(); // workerId → timestamps

  /** Decide what to do with a failed worker slot. */
  decide(slot: WorkerSlot, opts: FailurePolicyOptions = {}): FailureDecision {
    if (slot.status === "terminated") return "terminate";

    const maxRevive = opts.maxReviveAttempts ?? DEFAULT_MAX_REVIVE;
    const cooldown  = opts.reviveCooldownMs  ?? REVIVE_COOLDOWN_MS;

    const history = this.reviveTimestamps.get(slot.id) ?? [];
    const recent  = history.filter(ts => Date.now() - ts < cooldown * maxRevive);

    if (recent.length >= maxRevive) return "replace";
    if (slot.failureCount >= slot.maxFailures) return "terminate";
    return "revive";
  }

  /** Apply the policy decision to the registry. Returns new/replacement slot or null. */
  apply(slot: WorkerSlot, decision: FailureDecision): WorkerSlot | null {
    switch (decision) {
      case "revive": {
        const revived = reviveSlot(slot);
        workerRegistry.update(revived);
        const history = this.reviveTimestamps.get(slot.id) ?? [];
        this.reviveTimestamps.set(slot.id, [...history, Date.now()]);
        return revived;
      }

      case "replace": {
        workerRegistry.remove(slot.id);
        this.reviveTimestamps.delete(slot.id);
        const replacement = workerRegistry.register(slot.type, {
          maxFailures: slot.maxFailures,
          timeoutMs:   slot.timeoutMs,
        });
        return replacement;
      }

      case "terminate": {
        workerRegistry.remove(slot.id);
        this.reviveTimestamps.delete(slot.id);
        return null;
      }
    }
  }

  /** Clear history for a worker (called after successful run resets failure context). */
  resetHistory(workerId: string): void {
    this.reviveTimestamps.delete(workerId);
  }

  /** Summarize pending revive attempts for observability. */
  summary(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [id, ts] of this.reviveTimestamps) {
      out[id] = ts.length;
    }
    return out;
  }
}

export const workerFailurePolicy = new WorkerFailurePolicy();
