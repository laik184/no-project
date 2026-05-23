/**
 * Responsibility: Recovers stale/zombie distributed locks — scans Redis for TTL-expired
 *                 keys and the in-process registry for expired entries, then cleans them up.
 * Dependencies: redis-client, lock-registry, lock-telemetry
 * Failure: scan errors are logged; recovery continues for remaining keys.
 * Telemetry: emits lock.recovered via lock-telemetry for every cleaned lock.
 */

import { getRedisClient }  from "../redis/redis-client.ts";
import { lockRegistry }    from "./lock-registry.ts";
import { lockTelemetry }   from "./lock-telemetry.ts";
import { isRedisAvailable } from "../redis/index.ts";

const SCAN_INTERVAL_MS = 60_000;
const LOCK_PATTERN     = "nura:lock:*";

class LockRecovery {
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => { this.sweep().catch(console.error); }, SCAN_INTERVAL_MS);
    console.log("[lock-recovery] Started — sweeping stale locks every 60s.");
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  async sweep(): Promise<number> {
    let recovered = 0;
    recovered += await this.sweepRedis();
    recovered += this.sweepInProcess();
    if (recovered > 0) console.log(`[lock-recovery] Recovered ${recovered} stale lock(s).`);
    return recovered;
  }

  private async sweepRedis(): Promise<number> {
    if (!isRedisAvailable()) return 0;
    const client = await getRedisClient();
    if (!client) return 0;

    let recovered = 0;
    try {
      let cursor = "0";
      do {
        const [nextCursor, keys] = await client.scan(cursor, "MATCH", LOCK_PATTERN, "COUNT", 100);
        cursor = nextCursor;
        for (const key of keys) {
          const ttl = await client.pttl(key);
          // TTL = -2 means key doesn't exist (already expired/cleaned)
          if (ttl === -2) {
            const shortKey = key.replace("nura:lock:", "");
            lockTelemetry.onRecovered(shortKey, "redis-expired");
            recovered++;
          }
        }
      } while (cursor !== "0");
    } catch (err) {
      console.error("[lock-recovery] Redis sweep error:", (err as Error).message);
    }
    return recovered;
  }

  private sweepInProcess(): number {
    const before = lockRegistry.all().length;
    // Eviction happens on every lockRegistry read — just trigger it
    lockRegistry.all();
    const after = lockRegistry.all().length;
    const cleaned = before - after;
    if (cleaned > 0) lockTelemetry.onRecovered("in-process-batch", `${cleaned} expired entries`);
    return cleaned;
  }
}

export const lockRecovery = new LockRecovery();
