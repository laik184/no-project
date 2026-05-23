/**
 * Redis layer public API — single import point for all Redis infrastructure.
 */

export { getRedisClient, getRedisClientSync, isRedisAvailable, shutdownRedis, createDedicatedClient } from "./redis-client.ts";
export { redisConfig, buildRedisConfig }   from "./redis-config.ts";
export { redisHealth }                     from "./redis-health.ts";
export { redisReconnect }                  from "./redis-reconnect.ts";
export { redisTelemetry }                  from "./redis-telemetry.ts";
export type { RedisConfig, RedisHealthStatus, RedisReconnectState, RedisEventType } from "./types/index.ts";
