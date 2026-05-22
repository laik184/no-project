/**
 * Responsibility: Proactive lock timeout enforcer — scans all held locks and
 *                 force-releases any that have passed their expiry without natural release.
 *                 Provides a safety net on top of lock-registry's passive eviction.
 * Dependencies: lock-registry, distributed/telemetry/distributed-trace
 * Failure: never throws — logs and skips any errors during scan.
 * Telemetry: emits distributed.recovery for every force-released lock.
 */

import { lockRegistry }    from "./lock-registry.ts";
import { distributedTrace } from "../telemetry/distributed-trace.ts";
import { bus }             from "../../infrastructure/events/bus.ts";

// ── Config ────────────────────────────────────────────────────────────────────

const SCAN_INTERVAL_MS = 10_000; // scan every 10 seconds

// ── Enforcer ──────────────────────────────────────────────────────────────────

class LockTimeoutEnforcer {
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.scan(), SCAN_INTERVAL_MS);
    console.log("[lock-timeout] Timeout enforcer started.");
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private scan(): void {
    const now   = Date.now();
    const locks = lockRegistry.all();

    for (const entry of locks) {
      try {
        if (entry.expiresAt <= now) {
          // force-release by calling with the correct token (we own the registry)
          const released = lockRegistry.release(entry.key, entry.token);

          if (released) {
            console.warn(
              `[lock-timeout] Force-released stale lock: key=${entry.key} owner=${entry.ownerId}`,
            );

            distributedTrace.lockReleased(entry.key, entry.ownerId);

            bus.emit("agent.event", {
              runId:     entry.ownerId,
              projectId: 0,
              phase:     "distributed.lock",
              agentName: "lock-timeout",
              eventType: "distributed.recovery",
              payload:   { key: entry.key, ownerId: entry.ownerId, reason: "lock_timeout_eviction" },
              ts:        now,
            });
          }
        }
      } catch (err) {
        console.error(`[lock-timeout] Error scanning lock ${entry.key}:`, err);
      }
    }
  }
}

export const lockTimeoutEnforcer = new LockTimeoutEnforcer();
