/**
 * Responsibility: Periodic heartbeat scan — detects stale/timed-out workers
 *                 and transitions them to "failed" for recovery.
 * Dependencies: worker-registry, worker-slot, distributed/telemetry/worker-trace
 * Failure: gracefully skips errors; never crashes the monitor loop.
 * Telemetry: emits worker.failed on timeout, distributed.recovery on revive.
 */

import { workerRegistry }          from "./worker-registry.ts";
import { isTimedOut, isHealthy, failSlot } from "./worker-slot.ts";
import { workerTrace }             from "../telemetry/worker-trace.ts";
import { bus }                     from "../../infrastructure/events/bus.ts";

// ── Config ────────────────────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL_MS  = 5_000;
const MAX_HEARTBEAT_AGE_MS   = 30_000;

// ── Monitor ───────────────────────────────────────────────────────────────────

class WorkerHeartbeatMonitor {
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.scan(), HEARTBEAT_INTERVAL_MS);
    console.log("[worker-heartbeat] Monitor started — interval:", HEARTBEAT_INTERVAL_MS, "ms");
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Called by WorkerPool.execute() to refresh a slot's heartbeat timestamp. */
  ping(workerId: string): void {
    const slot = workerRegistry.get(workerId);
    if (!slot) return;
    workerRegistry.update({ ...slot, lastHeartbeat: Date.now() });
  }

  private scan(): void {
    const busy = workerRegistry.getBusy();

    for (const slot of busy) {
      try {
        const timedOut = isTimedOut(slot);
        const stale    = !isHealthy(slot, MAX_HEARTBEAT_AGE_MS);

        if (timedOut || stale) {
          const reason = timedOut ? "timeout" : "stale_heartbeat";
          const failed = failSlot(slot);
          workerRegistry.update(failed);

          workerTrace.workerFailed(slot.id, slot.taskId ?? "unknown", reason);

          bus.emit("agent.event", {
            runId:     slot.runId ?? "unknown",
            projectId: 0,
            phase:     "distributed.worker",
            agentName: "worker-heartbeat",
            eventType: "worker.failed",
            payload:   { workerId: slot.id, taskId: slot.taskId, reason },
            ts:        Date.now(),
          });
        }
      } catch (err) {
        console.error(`[worker-heartbeat] Scan error for slot ${slot.id}:`, err);
      }
    }

    // Evict terminated slots every scan cycle
    const evicted = workerRegistry.evictTerminated();
    if (evicted > 0) {
      console.log(`[worker-heartbeat] Evicted ${evicted} terminated worker(s).`);
    }
  }
}

export const workerHeartbeat = new WorkerHeartbeatMonitor();
