/**
 * Responsibility: Public API for the distributed lock system — acquire, release,
 *                 withLock RAII, heartbeat registration, and health queries.
 *                 Prefers Redis; falls back to in-process leases transparently.
 * Dependencies: lock-acquisition, redis-lock-store, lock-registry, lock-heartbeat,
 *               lock-recovery, lock-telemetry
 * Failure: withLock throws if acquisition fails within waitMs; acquire returns result.acquired=false.
 * Telemetry: delegates all events to lock-telemetry.
 */

import { lockAcquisition }  from "./lock-acquisition.ts";
import { redisLockStore }   from "./redis-lock-store.ts";
import { lockRegistry }     from "./lock-registry.ts";
import { lockHeartbeat }    from "./lock-heartbeat.ts";
import { lockRecovery }     from "./lock-recovery.ts";
import { lockTelemetry }    from "./lock-telemetry.ts";
import { isRedisAvailable } from "../redis/index.ts";
import type { DistributedLockOptions, DistributedLockResult } from "./types/index.ts";

class DistributedLockManager {
  init(): void {
    lockRecovery.start();
    console.log("[distributed-lock-manager] Initialized — backend:", isRedisAvailable() ? "Redis" : "in-process");
  }

  async acquire(key: string, opts: DistributedLockOptions): Promise<DistributedLockResult> {
    const result = await lockAcquisition.acquire(key, opts);

    if (result.acquired && result.token && opts.autoRenewMs && opts.autoRenewMs > 0) {
      lockHeartbeat.register(key, result.token, opts.ownerId, opts.ttlMs, opts.autoRenewMs);
    }
    return result;
  }

  async release(key: string, token: string, ownerId: string): Promise<boolean> {
    lockHeartbeat.unregister(key);

    const ok = isRedisAvailable()
      ? await redisLockStore.release(key, token)
      : lockRegistry.release(key, token);

    if (ok) lockTelemetry.onReleased(key, ownerId);
    return ok;
  }

  async withLock<T>(
    key:  string,
    opts: DistributedLockOptions,
    fn:   (token: string) => Promise<T>,
  ): Promise<T> {
    const result = await this.acquire(key, opts);
    if (!result.acquired || !result.token) {
      throw new Error(`[distributed-lock-manager] Could not acquire lock for "${key}" (owner=${opts.ownerId})`);
    }

    try {
      return await fn(result.token);
    } finally {
      await this.release(key, result.token, opts.ownerId);
    }
  }

  async isLocked(key: string): Promise<boolean> {
    return isRedisAvailable()
      ? redisLockStore.isLocked(key)
      : lockRegistry.isLocked(key);
  }

  health() {
    return {
      backend:        isRedisAvailable() ? "redis" : "in-process",
      activeHeartbeats: lockHeartbeat.activeCount(),
      inProcessLocks: lockRegistry.stats(),
      metrics:        lockTelemetry.snapshot(),
    };
  }

  async shutdown(): Promise<void> {
    lockRecovery.stop();
    lockHeartbeat.shutdown();
  }
}

export const distributedLockManager = new DistributedLockManager();
