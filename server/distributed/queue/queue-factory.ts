/**
 * Responsibility: Factory that creates BullMQ Queue instances backed by Redis,
 *                 with graceful fallback to in-process mode when Redis is absent.
 * Dependencies: redis-client, bullmq
 * Failure: returns null when Redis unavailable; callers fall back to in-memory queue.
 * Telemetry: logs creation/failure; does not emit bus events (delegated to queue-telemetry).
 */

import { Queue, type ConnectionOptions } from "bullmq";
import { redisConfig, isRedisAvailable } from "../redis/index.ts";
import type { DistributedJobData }       from "./types/index.ts";

const QUEUE_DEFAULTS = {
  defaultJobOptions: {
    removeOnComplete: { count: 500, age: 3600 },
    removeOnFail:     { count: 200 },
    attempts:         3,
    backoff: { type: "exponential" as const, delay: 500 },
  },
};

const createdQueues = new Map<string, Queue<DistributedJobData>>();

function buildConnection(): ConnectionOptions {
  return {
    host:     redisConfig.host,
    port:     redisConfig.port,
    password: redisConfig.password,
    db:       redisConfig.db,
  };
}

export function createQueue(name: string): Queue<DistributedJobData> | null {
  if (!isRedisAvailable()) {
    console.warn(`[queue-factory] Redis unavailable — queue "${name}" running in degraded mode.`);
    return null;
  }

  const existing = createdQueues.get(name);
  if (existing) return existing;

  try {
    const q = new Queue<DistributedJobData>(name, {
      connection: buildConnection(),
      ...QUEUE_DEFAULTS,
    });
    createdQueues.set(name, q);
    console.log(`[queue-factory] Queue "${name}" created (BullMQ/Redis).`);
    return q;
  } catch (err) {
    console.error(`[queue-factory] Failed to create queue "${name}":`, err);
    return null;
  }
}

export async function closeAllQueues(): Promise<void> {
  await Promise.all([...createdQueues.values()].map(q => q.close()));
  createdQueues.clear();
}

export function getConnection(): ConnectionOptions {
  return buildConnection();
}
