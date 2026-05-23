/**
 * Responsibility: Periodic Redis health checks — PING latency, connection state,
 *                 error rate, and uptime tracking.
 * Dependencies: redis-client, redis-telemetry
 * Failure: health check errors are caught and reported as unhealthy; never throws.
 * Telemetry: exposes RedisHealthStatus for observability endpoints.
 */

import { getRedisClient, isRedisAvailable } from "./redis-client.ts";
import { redisTelemetry }                   from "./redis-telemetry.ts";
import type { RedisHealthStatus }            from "./types/index.ts";

const PING_INTERVAL_MS = 30_000;
const PING_TIMEOUT_MS  = 2_000;

class RedisHealth {
  private latencyMs:  number | null = null;
  private lastPingAt: number | null = null;
  private errorCount = 0;
  private timer:     ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => { this.ping().catch(() => {}); }, PING_INTERVAL_MS);
    this.ping().catch(() => {});
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  async ping(): Promise<boolean> {
    const client = await getRedisClient();
    if (!client) {
      this.errorCount++;
      return false;
    }

    const start = Date.now();
    try {
      const pong = await Promise.race([
        client.ping(),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("ping timeout")), PING_TIMEOUT_MS)),
      ]);
      if (pong === "PONG") {
        this.latencyMs  = Date.now() - start;
        this.lastPingAt = Date.now();
        return true;
      }
      this.errorCount++;
      return false;
    } catch (err) {
      this.errorCount++;
      redisTelemetry.onError(err as Error);
      return false;
    }
  }

  status(): RedisHealthStatus {
    return {
      connected:  isRedisAvailable(),
      latencyMs:  this.latencyMs,
      lastPingAt: this.lastPingAt,
      errorCount: this.errorCount,
      uptime:     redisTelemetry.snapshot().uptime,
    };
  }
}

export const redisHealth = new RedisHealth();
