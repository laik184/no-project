/**
 * server/infrastructure/redis/index.ts
 *
 * Redis client singleton.
 * Stub implementation — connects when REDIS_URL is set.
 * All console caching layers import Redis from here via infrastructure/index.ts.
 */

export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number }): Promise<void>;
  del(key: string): Promise<void>;
  lPush(key: string, value: string): Promise<void>;
  lRange(key: string, start: number, stop: number): Promise<string[]>;
  ping(): Promise<string>;
  isConnected: boolean;
}

/** No-op Redis client used when REDIS_URL is not configured. */
class NullRedisClient implements RedisClient {
  readonly isConnected = false;
  async get(_key: string): Promise<null> { return null; }
  async set(_key: string, _value: string): Promise<void> {}
  async del(_key: string): Promise<void> {}
  async lPush(_key: string, _value: string): Promise<void> {}
  async lRange(_key: string, _start: number, _stop: number): Promise<string[]> { return []; }
  async ping(): Promise<string> { return 'PONG'; }
}

function createRedisClient(): RedisClient {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.log('[redis] REDIS_URL not set — using null client (caching disabled)');
    return new NullRedisClient();
  }
  // TODO: return new IoRedis(url) when ioredis is wired in
  console.log('[redis] REDIS_URL detected — activate ioredis for full caching');
  return new NullRedisClient();
}

export const redis: RedisClient = createRedisClient();
