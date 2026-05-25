/**
 * Responsibility: Redis-backed distributed synchronization barrier — blocks
 *                 downstream execution until all expected parallel workers
 *                 across ALL processes have "arrived" at the barrier.
 *                 Falls back to the in-process barrier when Redis is absent.
 * Dependencies: redis-client, in-process distributed-sync-barrier, bus
 * Failure: timeout resolves the barrier with partial results (non-blocking safety valve).
 * Telemetry: emits sync.wait on arrive; distributed.recovery on timeout.
 */

import { getRedisClientSync, isRedisAvailable } from "../redis/index.ts";
import { distributedSyncBarrier as inProcessBarrier } from "../../infrastructure/events/distributed-sync-barrier.ts";
import { bus } from "../../infrastructure/events/bus.ts";

// ── Config ────────────────────────────────────────────────────────────────────

const BARRIER_TTL_S = 300;   // 5 minutes hard cap on any barrier key
const POLL_MS       = 100;   // Redis polling interval

// ── Redis key helpers ─────────────────────────────────────────────────────────

function barrierKey(runId: string, name: string): string {
  return `nura:barrier:${runId}:${name}`;
}

// ── Distributed barrier ───────────────────────────────────────────────────────

class RedisDistributedSyncBarrier {
  /**
   * Create a barrier for `expected` workers across all processes.
   * When Redis is unavailable, delegates to the in-process barrier.
   * Returns a promise that resolves when all expected workers have arrived,
   * or rejects after `timeoutMs` ms.
   */
  async create(
    runId:     string,
    name:      string,
    expected:  number,
    timeoutMs = 60_000,
  ): Promise<void> {
    if (!isRedisAvailable()) {
      return inProcessBarrier.create(runId, name, expected, timeoutMs);
    }

    const key      = barrierKey(runId, name);
    const deadline = Date.now() + timeoutMs;

    return new Promise<void>((resolve, reject) => {
      const poll = async (): Promise<void> => {
        if (Date.now() >= deadline) {
          const redis = getRedisClientSync();
          const count = redis ? parseInt((await redis.get(key)) ?? "0", 10) : 0;
          await redis?.del(key).catch(() => {});

          bus.emit("agent.event", {
            runId, projectId: 0,
            phase:     "distributed.sync",
            agentName: "redis-sync-barrier",
            eventType: "distributed.recovery",
            payload:   { barrier: name, expected, arrived: count, reason: "barrier_timeout" },
            ts:        Date.now(),
          });

          reject(new Error(
            `[redis-sync-barrier] Barrier "${name}" timed out (arrived ${count}/${expected})`,
          ));
          return;
        }

        try {
          const redis = getRedisClientSync();
          if (!redis) { resolve(); return; } // Redis disappeared — degrade safely

          const count = parseInt((await redis.get(key)) ?? "0", 10);
          if (count >= expected) {
            await redis.del(key).catch(() => {});
            resolve();
            return;
          }
        } catch {
          // Redis error during poll — degrade to resolved rather than blocking forever
          resolve();
          return;
        }

        setTimeout(poll, POLL_MS);
      };

      setTimeout(poll, POLL_MS);
    });
  }

  /**
   * Mark a worker as arrived at the barrier.
   * Uses Redis INCR for atomic multi-process counting.
   * Falls back to in-process barrier when Redis is unavailable.
   */
  async arrive(runId: string, name: string, workerId: string): Promise<void> {
    if (!isRedisAvailable()) {
      inProcessBarrier.arrive(runId, name, workerId);
      return;
    }

    const key   = barrierKey(runId, name);
    const redis = getRedisClientSync();
    if (!redis) { inProcessBarrier.arrive(runId, name, workerId); return; }

    try {
      const count = await redis.incr(key);
      await redis.expire(key, BARRIER_TTL_S);

      bus.emit("agent.event", {
        runId, projectId: 0,
        phase:     "distributed.sync",
        agentName: "redis-sync-barrier",
        eventType: "sync.wait",
        payload:   { barrier: name, workerId, arrived: count, backend: "redis" },
        ts:        Date.now(),
      });
    } catch (err) {
      console.error("[redis-sync-barrier] Arrive error:", (err as Error).message);
      inProcessBarrier.arrive(runId, name, workerId);
    }
  }

  /** Delete a barrier key — call on run abort to avoid stale keys. */
  async cleanup(runId: string, name: string): Promise<void> {
    const redis = getRedisClientSync();
    if (!redis) return;
    await redis.del(barrierKey(runId, name)).catch(() => {});
  }
}

export const redisSyncBarrier = new RedisDistributedSyncBarrier();
