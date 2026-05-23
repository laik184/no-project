/**
 * Responsibility: Heartbeat renewal for long-lived distributed locks.
 *                 Periodically extends TTL for registered locks using Redis renew or in-process.
 * Dependencies: redis-lock-store, lock-registry, lock-telemetry
 * Failure: failed renewals log warning; heartbeat continues for other locks.
 * Telemetry: emits lock.heartbeat and lock.expired via lock-telemetry.
 */

import { redisLockStore }  from "./redis-lock-store.ts";
import { lockRegistry }    from "./lock-registry.ts";
import { lockTelemetry }   from "./lock-telemetry.ts";
import { isRedisAvailable } from "../redis/index.ts";
import type { LockHeartbeatEntry } from "./types/index.ts";

class LockHeartbeat {
  private readonly entries = new Map<string, LockHeartbeatEntry>();

  register(key: string, token: string, ownerId: string, ttlMs: number, renewMs: number): void {
    if (this.entries.has(key)) this.unregister(key);

    const timer = setInterval(async () => {
      const ok = await this.renew(key, token, ttlMs);
      if (ok) {
        lockTelemetry.onHeartbeat(key, ownerId);
      } else {
        console.warn(`[lock-heartbeat] Renewal failed for key="${key}" — lock may have expired.`);
        lockTelemetry.onExpired(key, ownerId);
        this.unregister(key);
      }
    }, renewMs);

    this.entries.set(key, { key, token, ownerId, renewMs, timer });
  }

  unregister(key: string): void {
    const entry = this.entries.get(key);
    if (entry) { clearInterval(entry.timer); this.entries.delete(key); }
  }

  private async renew(key: string, token: string, ttlMs: number): Promise<boolean> {
    if (isRedisAvailable()) {
      return redisLockStore.renew(key, token, ttlMs);
    }
    return lockRegistry.renew(key, token, ttlMs);
  }

  activeCount(): number { return this.entries.size; }

  shutdown(): void {
    for (const entry of this.entries.values()) clearInterval(entry.timer);
    this.entries.clear();
  }
}

export const lockHeartbeat = new LockHeartbeat();
