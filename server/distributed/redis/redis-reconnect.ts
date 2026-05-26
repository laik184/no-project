/**
 * Responsibility: Exponential backoff reconnect strategy for IORedis.
 * Dependencies: none
 * Failure: caps at maxDelayMs; never returns negative delay.
 * Telemetry: exposes reconnect state for redis-health.
 *
 * Reconnect policy:
 *   - REDIS_URL explicitly set → unlimited retries (production Redis should
 *     always recover; giving up leaves the system permanently degraded).
 *   - No explicit URL (default 127.0.0.1) → cap at 30 attempts then stop
 *     (no point hammering localhost when Redis is not configured).
 */

import type { RedisReconnectState } from "./types/index.ts";

const BASE_DELAY_MS = 200;
const MAX_DELAY_MS  = 30_000;

/** True when the operator explicitly configured a Redis endpoint. */
const HAS_EXPLICIT_URL = !!(
  process.env.REDIS_URL
  || process.env.REDIS_TLS_URL
  || process.env.KV_URL
  || process.env.REDIS_HOST
);

const MAX_ATTEMPTS_DEFAULT = 30;

class RedisReconnect {
  private attempt      = 0;
  private lastError:   string | null = null;
  private reconnecting = false;

  /**
   * Called by IORedis retryStrategy — returns delay ms or null to stop.
   * null causes IORedis to permanently stop reconnecting for this client.
   */
  strategy(times: number): number | null {
    this.attempt      = times;
    this.reconnecting = true;

    if (!HAS_EXPLICIT_URL && times > MAX_ATTEMPTS_DEFAULT) {
      console.error(
        `[redis-reconnect] No REDIS_URL configured and ${MAX_ATTEMPTS_DEFAULT} `
        + `connect attempts exhausted — stopping. `
        + `Set REDIS_URL in Replit Secrets to enable distributed mode.`,
      );
      this.reconnecting = false;
      return null;
    }

    const jitter = Math.random() * 100;
    const delay  = Math.min(BASE_DELAY_MS * Math.pow(2, times - 1) + jitter, MAX_DELAY_MS);
    console.warn(`[redis-reconnect] Attempt ${times} — retrying in ${Math.round(delay)}ms`);
    return Math.round(delay);
  }

  recordError(err: Error): void {
    this.lastError = err.message;
  }

  onConnected(): void {
    this.attempt      = 0;
    this.lastError    = null;
    this.reconnecting = false;
  }

  state(): RedisReconnectState {
    const times     = this.attempt;
    const jitter    = 50;
    const nextRetry = Math.min(BASE_DELAY_MS * Math.pow(2, times) + jitter, MAX_DELAY_MS);
    return {
      attempt:        this.attempt,
      lastError:      this.lastError,
      nextRetryMs:    Math.round(nextRetry),
      isReconnecting: this.reconnecting,
    };
  }
}

export const redisReconnect = new RedisReconnect();
