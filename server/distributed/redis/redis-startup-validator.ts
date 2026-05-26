/**
 * Responsibility: Structured Redis startup validation — checks REDIS_URL presence,
 *                 tests actual connectivity with a PING, and reports readiness with
 *                 explicit pass/fail/degraded status.
 * Dependencies: redis-client, redis-config
 * Failure: always resolves; never throws. Reports degraded on any failure.
 * Telemetry: emits redis.startup.validated / redis.startup.degraded to bus.
 */

import { getRedisClient }  from "./redis-client.ts";
import { bus }             from "../../infrastructure/events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RedisStartupStatus = "connected" | "degraded" | "misconfigured";

export interface RedisStartupReport {
  status:      RedisStartupStatus;
  latencyMs:   number | null;
  hasUrl:      boolean;
  urlSource:   string | null;
  message:     string;
  howToFix:    string | null;
}

// ── Config ────────────────────────────────────────────────────────────────────

const PING_TIMEOUT_MS = 3_000;

const HOW_TO_FIX =
  "Add REDIS_URL in Replit Secrets. "
  + "Free tier: https://upstash.com → create Redis DB → copy REST URL. "
  + "Set REDIS_URL=redis://default:<password>@<host>:<port> in Replit Secrets.";

// ── Validator ─────────────────────────────────────────────────────────────────

class RedisStartupValidator {
  async validate(): Promise<RedisStartupReport> {
    const urlSource = this.detectUrlSource();
    const hasUrl    = urlSource !== null;

    if (!hasUrl) {
      const report: RedisStartupReport = {
        status:    "degraded",
        latencyMs: null,
        hasUrl:    false,
        urlSource: null,
        message:   "REDIS_URL not set — all distributed systems running in single-node in-process mode.",
        howToFix:  HOW_TO_FIX,
      };
      this.log(report);
      this.emit("redis.startup.degraded", report);
      return report;
    }

    const t0    = Date.now();
    const client = await getRedisClient().catch(() => null);

    if (!client) {
      const report: RedisStartupReport = {
        status:    "misconfigured",
        latencyMs: null,
        hasUrl:    true,
        urlSource,
        message:   `REDIS_URL is set (via ${urlSource}) but connection failed. Check host/port/password.`,
        howToFix:  HOW_TO_FIX,
      };
      this.log(report);
      this.emit("redis.startup.degraded", report);
      return report;
    }

    try {
      const pong = await Promise.race([
        client.ping(),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error("PING timeout")), PING_TIMEOUT_MS),
        ),
      ]);

      const latencyMs = Date.now() - t0;

      if (pong !== "PONG") {
        throw new Error(`Unexpected PING response: ${pong}`);
      }

      const report: RedisStartupReport = {
        status:    "connected",
        latencyMs,
        hasUrl:    true,
        urlSource,
        message:   `Redis connected — ${latencyMs}ms PING latency. Full distributed mode active.`,
        howToFix:  null,
      };
      this.log(report);
      this.emit("redis.startup.validated", report);
      return report;

    } catch (err) {
      const report: RedisStartupReport = {
        status:    "misconfigured",
        latencyMs: null,
        hasUrl:    true,
        urlSource,
        message:   `Redis PING failed: ${(err as Error).message}`,
        howToFix:  HOW_TO_FIX,
      };
      this.log(report);
      this.emit("redis.startup.degraded", report);
      return report;
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private detectUrlSource(): string | null {
    if (process.env.REDIS_URL)     return "REDIS_URL";
    if (process.env.REDIS_TLS_URL) return "REDIS_TLS_URL";
    if (process.env.KV_URL)        return "KV_URL";
    if (process.env.REDIS_HOST)    return "REDIS_HOST";
    return null;
  }

  private log(r: RedisStartupReport): void {
    if (r.status === "connected") {
      console.log(`[redis-startup-validator] ✅ ${r.message}`);
    } else {
      console.warn(`[redis-startup-validator] ⚠️  ${r.message}`);
      if (r.howToFix) console.warn(`[redis-startup-validator] → ${r.howToFix}`);
    }
  }

  private emit(eventType: string, report: RedisStartupReport): void {
    try {
      bus.emit("agent.event", {
        runId:     "system",
        projectId: 0,
        phase:     "startup.redis-validation",
        agentName: "redis-startup-validator",
        eventType: eventType as any,
        payload:   report,
        ts:        Date.now(),
      });
    } catch { /* bus may not be ready at earliest startup */ }
  }
}

export const redisStartupValidator = new RedisStartupValidator();
