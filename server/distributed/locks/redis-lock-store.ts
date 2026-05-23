/**
 * Responsibility: Redis-backed distributed lock store using SET NX PX (Redlock pattern).
 *                 Provides atomic acquire, release, and renew operations across processes.
 * Dependencies: redis-client
 * Failure: all methods return false/null on Redis unavailability; never throws.
 * Telemetry: none — pure storage layer; callers emit telemetry.
 */

import { getRedisClient } from "../redis/redis-client.ts";

const LOCK_PREFIX = "lock:";

class RedisLockStore {
  /** Atomic SET NX PX — returns token on success, null if already held. */
  async acquire(key: string, ownerId: string, ttlMs: number): Promise<string | null> {
    const client = await getRedisClient();
    if (!client) return null;

    const token  = `${ownerId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const redisKey = `${LOCK_PREFIX}${key}`;

    try {
      const result = await client.set(redisKey, token, "PX", ttlMs, "NX");
      return result === "OK" ? token : null;
    } catch (err) {
      console.warn("[redis-lock-store] acquire error:", (err as Error).message);
      return null;
    }
  }

  /** Release only if token matches — atomic Lua script to prevent foreign release. */
  async release(key: string, token: string): Promise<boolean> {
    const client = await getRedisClient();
    if (!client) return false;

    const redisKey = `${LOCK_PREFIX}${key}`;
    const script   = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    try {
      const result = await client.eval(script, 1, redisKey, token);
      return result === 1;
    } catch (err) {
      console.warn("[redis-lock-store] release error:", (err as Error).message);
      return false;
    }
  }

  /** Renew TTL only if token matches — atomic Lua script. */
  async renew(key: string, token: string, ttlMs: number): Promise<boolean> {
    const client = await getRedisClient();
    if (!client) return false;

    const redisKey = `${LOCK_PREFIX}${key}`;
    const script   = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    try {
      const result = await client.eval(script, 1, redisKey, token, String(ttlMs));
      return result === 1;
    } catch {
      return false;
    }
  }

  /** Check if a key is currently locked. */
  async isLocked(key: string): Promise<boolean> {
    const client = await getRedisClient();
    if (!client) return false;
    try {
      return (await client.exists(`${LOCK_PREFIX}${key}`)) === 1;
    } catch { return false; }
  }

  /** TTL remaining in ms, -1 if not found. */
  async ttl(key: string): Promise<number> {
    const client = await getRedisClient();
    if (!client) return -1;
    try {
      return await client.pttl(`${LOCK_PREFIX}${key}`);
    } catch { return -1; }
  }
}

export const redisLockStore = new RedisLockStore();
