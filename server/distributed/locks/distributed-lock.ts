/**
 * Responsibility: High-level distributed lock API — wraps lease-manager with
 *                 auto-renewal and RAII-style "withLock" execution.
 * Dependencies: lease-manager, lock-registry, distributed/telemetry/distributed-trace
 * Failure: lock acquisition failure returns false; "withLock" throws on acquisition timeout.
 * Telemetry: emits lock.acquired, lock.released, distributed.retry on contention.
 */

import { leaseManager, LeaseAcquireOptions, Lease } from "./lease-manager.ts";
import { distributedTrace }                         from "../telemetry/distributed-trace.ts";
import { bus }                                      from "../../infrastructure/events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LockOptions extends LeaseAcquireOptions {
  waitMs?:       number;   // how long to wait if lock is contended
  retryMs?:      number;   // poll interval during wait
  autoRenewMs?:  number;   // renewal interval (0 = no auto-renewal)
}

export interface LockAcquireResult {
  acquired: boolean;
  lease:    Lease | null;
}

// ── Distributed Lock ──────────────────────────────────────────────────────────

class DistributedLock {
  /** Try to acquire a lock with optional wait. */
  async acquire(key: string, opts: LockOptions): Promise<LockAcquireResult> {
    const waitMs  = opts.waitMs  ?? 0;
    const retryMs = opts.retryMs ?? 100;
    const deadline = Date.now() + waitMs;

    let attempt = 0;
    do {
      const lease = leaseManager.acquire(key, opts);
      if (lease) {
        distributedTrace.lockAcquired(key, opts.ownerId);
        this.emitLockEvent("lock.acquired", key, opts.ownerId);
        return { acquired: true, lease };
      }

      attempt++;
      this.emitLockEvent("distributed.retry", key, opts.ownerId, { attempt });
      distributedTrace.syncWait(key, opts.ownerId);

      await new Promise<void>(r => setTimeout(r, retryMs));
    } while (Date.now() < deadline);

    return { acquired: false, lease: null };
  }

  /** Release a previously acquired lease. */
  release(key: string, token: string, ownerId: string): boolean {
    const ok = leaseManager.release(key, token);
    if (ok) {
      distributedTrace.lockReleased(key, ownerId);
      this.emitLockEvent("lock.released", key, ownerId);
    }
    return ok;
  }

  /**
   * RAII-style lock: acquire → execute fn → release.
   * Throws if lock cannot be acquired within waitMs.
   */
  async withLock<T>(
    key:     string,
    opts:    LockOptions,
    fn:      (lease: Lease) => Promise<T>,
  ): Promise<T> {
    const result = await this.acquire(key, opts);
    if (!result.acquired || !result.lease) {
      throw new Error(`[distributed-lock] Could not acquire lock for "${key}" (owner=${opts.ownerId})`);
    }

    const lease   = result.lease;
    let renewTimer: ReturnType<typeof setInterval> | null = null;

    if (opts.autoRenewMs && opts.autoRenewMs > 0) {
      renewTimer = setInterval(() => leaseManager.renew(lease), opts.autoRenewMs);
    }

    try {
      return await fn(lease);
    } finally {
      if (renewTimer) clearInterval(renewTimer);
      this.release(key, lease.token, opts.ownerId);
    }
  }

  private emitLockEvent(
    eventType: string,
    key:       string,
    ownerId:   string,
    extra?:    Record<string, unknown>,
  ): void {
    bus.emit("agent.event", {
      runId:     ownerId,
      projectId: 0,
      phase:     "distributed.lock",
      agentName: "distributed-lock",
      eventType,
      payload:   { key, ownerId, ...extra },
      ts:        Date.now(),
    });
  }
}

export const distributedLock = new DistributedLock();
