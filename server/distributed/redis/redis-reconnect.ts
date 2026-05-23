/**
 * Responsibility: Exponential backoff reconnect strategy for IORedis.
 * Dependencies: none
 * Failure: caps at maxDelayMs; never returns negative delay.
 * Telemetry: exposes reconnect state for redis-health.
 */

import type { RedisReconnectState } from "./types/index.ts";

const BASE_DELAY_MS  = 200;
const MAX_DELAY_MS   = 30_000;
const MAX_ATTEMPTS   = 30;

class RedisReconnect {
  private attempt      = 0;
  private lastError:   string | null = null;
  private reconnecting = false;

  /** Called by IORedis retryStrategy — returns delay ms or null to stop. */
  strategy(times: number): number | null {
    this.attempt      = times;
    this.reconnecting = true;

    if (times > MAX_ATTEMPTS) {
      console.error(`[redis-reconnect] Max reconnect attempts (${MAX_ATTEMPTS}) reached — giving up.`);
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
