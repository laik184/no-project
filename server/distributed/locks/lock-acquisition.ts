/**
 * Responsibility: Orchestrates distributed lock acquisition with retry/wait logic,
 *                 preferring Redis store when available, falling back to in-process registry.
 * Dependencies: redis-lock-store, lock-registry, lock-telemetry
 * Failure: returns { acquired: false } after timeout; never throws.
 * Telemetry: emits lock.acquired / lock.contention via lock-telemetry.
 */

import { redisLockStore }  from "./redis-lock-store.ts";
import { lockRegistry }    from "./lock-registry.ts";
import { lockTelemetry }   from "./lock-telemetry.ts";
import { isRedisAvailable } from "../redis/index.ts";
import type { DistributedLockOptions, DistributedLockResult } from "./types/index.ts";
import { v4 as uuidv4 }   from "uuid";

const DEFAULT_RETRY_MS = 100;
const DEFAULT_WAIT_MS  = 0;

class LockAcquisition {
  async acquire(key: string, opts: DistributedLockOptions): Promise<DistributedLockResult> {
    const waitMs  = opts.waitMs  ?? DEFAULT_WAIT_MS;
    const retryMs = opts.retryMs ?? DEFAULT_RETRY_MS;
    const deadline = Date.now() + waitMs;
    let attempt = 0;

    do {
      const result = await this.tryOnce(key, opts);
      if (result.acquired) return result;

      attempt++;
      lockTelemetry.onContention(key, opts.ownerId, attempt);
      if (Date.now() + retryMs > deadline && attempt > 0) break;
      await new Promise<void>(r => setTimeout(r, retryMs));
    } while (Date.now() < deadline);

    lockTelemetry.onTimeout(key, opts.ownerId);
    return { acquired: false, token: null, key, ownerId: opts.ownerId, expiresAt: null };
  }

  private async tryOnce(key: string, opts: DistributedLockOptions): Promise<DistributedLockResult> {
    if (isRedisAvailable()) {
      const token = await redisLockStore.acquire(key, opts.ownerId, opts.ttlMs);
      if (token) {
        const expiresAt = Date.now() + opts.ttlMs;
        lockTelemetry.onAcquired(key, opts.ownerId, "redis");
        return { acquired: true, token, key, ownerId: opts.ownerId, expiresAt };
      }
      return { acquired: false, token: null, key, ownerId: opts.ownerId, expiresAt: null };
    }

    // In-process fallback
    const token = uuidv4();
    const ok    = lockRegistry.tryAcquire({
      key, ownerId: opts.ownerId, token,
      acquiredAt: Date.now(),
      expiresAt:  Date.now() + opts.ttlMs,
      renewable:  opts.renewable ?? false,
    });

    if (ok) {
      lockTelemetry.onAcquired(key, opts.ownerId, "in-process");
      return { acquired: true, token, key, ownerId: opts.ownerId, expiresAt: Date.now() + opts.ttlMs };
    }
    return { acquired: false, token: null, key, ownerId: opts.ownerId, expiresAt: null };
  }
}

export const lockAcquisition = new LockAcquisition();
