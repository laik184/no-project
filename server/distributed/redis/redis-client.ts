/**
 * Responsibility: Singleton IORedis client — connection lifecycle, reconnect wiring,
 *                 graceful shutdown, and telemetry hooks.
 * Dependencies: redis-config, redis-reconnect, redis-telemetry
 * Failure: connect() resolves false on error; never throws on construction.
 * Telemetry: delegates all events to redis-telemetry.
 */

import Redis from "ioredis";
import { redisConfig }         from "./redis-config.ts";
import { redisReconnect }      from "./redis-reconnect.ts";
import { redisTelemetry }      from "./redis-telemetry.ts";
import { redisOnConnectHooks } from "./redis-on-connect-hooks.ts";

// ── Singleton ─────────────────────────────────────────────────────────────────

let instance: Redis | null = null;
let available = false;

function createClient(): Redis {
  const cfg = redisConfig;

  const client = new Redis({
    host:               cfg.host,
    port:               cfg.port,
    password:           cfg.password,
    db:                 cfg.db,
    keyPrefix:          cfg.keyPrefix,
    connectTimeout:     cfg.connectTimeoutMs,
    commandTimeout:     cfg.commandTimeoutMs,
    maxRetriesPerRequest: cfg.maxRetriesPerReq,
    lazyConnect:        cfg.lazyConnect,
    enableOfflineQueue: cfg.enableOfflineQueue,
    retryStrategy:      (times) => redisReconnect.strategy(times),
    reconnectOnError:   cfg.reconnectOnError,
  });

  client.on("connect",     () => { available = true;  redisReconnect.onConnected(); redisTelemetry.onConnected(); });
  client.on("ready",       () => { available = true;  redisTelemetry.onReady(); redisOnConnectHooks.fire().catch(console.error); });
  client.on("error",       (err: Error) => { redisReconnect.recordError(err); redisTelemetry.onError(err); });
  client.on("close",       () => { available = false; redisTelemetry.onClose(); redisOnConnectHooks.reset(); });
  client.on("end",         () => { available = false; redisTelemetry.onDisconnected(); redisOnConnectHooks.reset(); });
  client.on("reconnecting",({ attempt, delay }: { attempt: number; delay: number }) => {
    redisTelemetry.onReconnecting(attempt, delay);
  });

  return client;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getRedisClient(): Promise<Redis | null> {
  if (instance && available) return instance;
  if (instance) return instance; // let it reconnect

  instance = createClient();

  try {
    await instance.connect();
    return instance;
  } catch (err) {
    console.warn("[redis-client] Initial connect failed — Redis unavailable:", (err as Error).message);
    console.warn("[redis-client] System will operate in degraded in-process mode.");
    return null;
  }
}

export function getRedisClientSync(): Redis | null {
  return instance && available ? instance : null;
}

export function isRedisAvailable(): boolean {
  return available;
}

export async function shutdownRedis(): Promise<void> {
  if (!instance) return;
  console.log("[redis-client] Shutting down Redis connection...");
  await instance.quit();
  instance  = null;
  available = false;
}

/** Returns a dedicated connection for BullMQ / pub-sub (requires separate connections). */
export function createDedicatedClient(): Redis {
  const cfg = redisConfig;
  return new Redis({
    host:               cfg.host,
    port:               cfg.port,
    password:           cfg.password,
    db:                 cfg.db,
    keyPrefix:          cfg.keyPrefix,
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
  });
}
