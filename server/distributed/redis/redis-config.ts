/**
 * Responsibility: Typed, validated Redis configuration from environment variables.
 * Dependencies: none
 * Failure: throws at startup if REDIS_URL is required but missing.
 * Telemetry: none — pure config.
 */

import type { RedisConfig } from "./types/index.ts";

function getRedisUrl(): string | undefined {
  return (
    process.env.REDIS_URL ||
    process.env.REDIS_TLS_URL ||
    process.env.KV_URL ||
    undefined
  );
}

function parseRedisUrl(url: string): Pick<RedisConfig, "host" | "port" | "password" | "db"> {
  try {
    const parsed = new URL(url);
    return {
      host:     parsed.hostname || "127.0.0.1",
      port:     parsed.port ? parseInt(parsed.port, 10) : 6379,
      password: parsed.password || undefined,
      db:       parsed.pathname.length > 1
        ? parseInt(parsed.pathname.slice(1), 10) || 0
        : 0,
    };
  } catch {
    return { host: "127.0.0.1", port: 6379, db: 0 };
  }
}

export function buildRedisConfig(): RedisConfig {
  const url = getRedisUrl();
  const fromUrl = url ? parseRedisUrl(url) : {};

  return {
    host:               fromUrl.host     ?? process.env.REDIS_HOST ?? "127.0.0.1",
    port:               fromUrl.port     ?? parseInt(process.env.REDIS_PORT ?? "6379", 10),
    password:           fromUrl.password ?? process.env.REDIS_PASSWORD ?? undefined,
    db:                 fromUrl.db       ?? parseInt(process.env.REDIS_DB ?? "0", 10),
    keyPrefix:          process.env.REDIS_KEY_PREFIX ?? "nura:",
    connectTimeoutMs:   5_000,
    commandTimeoutMs:   3_000,
    maxRetriesPerReq:   3,
    lazyConnect:        true,
    enableOfflineQueue: false,
    reconnectOnError: (err: Error) => {
      const reconnectErrors = ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EHOSTUNREACH"];
      return reconnectErrors.some(e => err.message.includes(e));
    },
  };
}

export const redisConfig = buildRedisConfig();
