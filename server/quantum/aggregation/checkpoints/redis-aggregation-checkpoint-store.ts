/**
 * Responsibility: Redis-backed IAggregationCheckpointStore.
 *                 Persists aggregation checkpoints as Redis HASH entries with
 *                 a 1-hour TTL. Falls back to the in-process store when Redis
 *                 is unavailable so the sync interface contract is always met.
 * Dependencies: redis-client, AggregationCheckpointStore (fallback)
 * Failure: all Redis errors fall through to in-process fallback; never throws.
 * Telemetry: emits aggregation.checkpoint.persisted / aggregation.checkpoint.miss
 *            to bus on save/load operations.
 */

import { getRedisClient, isRedisAvailable } from "../../distributed/redis/index.ts";
import { AggregationCheckpointStore }       from "./aggregation-checkpoint-store.ts";
import { bus }                              from "../../infrastructure/events/bus.ts";
import type { IAggregationCheckpointStore } from "../contracts/aggregation.interfaces.ts";
import type {
  AggregationCheckpoint,
  StreamingSessionId,
  PartialAggregationState,
} from "../contracts/aggregation.types.ts";

const KEY_PREFIX = "nura:ckpt:agg:";
const TTL_SECS   = 3_600; // 1 hour

// ── Store ─────────────────────────────────────────────────────────────────────

export class RedisAggregationCheckpointStore implements IAggregationCheckpointStore {
  private readonly _fallback = new AggregationCheckpointStore();

  // ── Write ────────────────────────────────────────────────────────────────

  save(checkpoint: AggregationCheckpoint): void {
    // Always write to in-process fallback first (sync, guaranteed)
    this._fallback.save(checkpoint);

    // Fire-and-forget Redis persistence — durability across restarts
    if (isRedisAvailable()) {
      this._redisSave(checkpoint).catch(err =>
        console.warn("[redis-ckpt] save error:", (err as Error).message),
      );
    }
  }

  /** Create a checkpoint snapshot from a live state (convenience factory). */
  checkpoint(state: PartialAggregationState): AggregationCheckpoint {
    const cp = this._fallback.checkpoint(state);
    if (isRedisAvailable()) {
      this._redisSave(cp).catch(err =>
        console.warn("[redis-ckpt] checkpoint save error:", (err as Error).message),
      );
    }
    return cp;
  }

  // ── Read ─────────────────────────────────────────────────────────────────

  load(sessionId: StreamingSessionId): AggregationCheckpoint | undefined {
    // In-process is always current for live sessions
    const local = this._fallback.load(sessionId);
    if (local) return local;

    // Schedule async Redis recovery — caller may retry after restart
    if (isRedisAvailable()) {
      this._redisLoadInto(sessionId).catch(() => {});
    }
    return undefined;
  }

  loadAll(sessionId: StreamingSessionId): AggregationCheckpoint[] {
    const local = this._fallback.loadAll(sessionId);
    if (local.length > 0) return local;

    if (isRedisAvailable()) {
      this._redisLoadInto(sessionId).catch(() => {});
    }
    return [];
  }

  prune(sessionId: StreamingSessionId, keepLast = 5): void {
    this._fallback.prune(sessionId, keepLast);
    // No Redis prune needed — TTL handles expiry
  }

  clear(sessionId: StreamingSessionId): void {
    this._fallback.clear(sessionId);
    if (isRedisAvailable()) {
      getRedisClient().then(c => c?.del(KEY_PREFIX + sessionId)).catch(() => {});
    }
  }

  // ── Redis internals ───────────────────────────────────────────────────────

  private async _redisSave(cp: AggregationCheckpoint): Promise<void> {
    const client = await getRedisClient();
    if (!client) return;
    const key = KEY_PREFIX + cp.sessionId;
    await client.hset(key, cp.id, JSON.stringify(cp));
    await client.expire(key, TTL_SECS);
    bus.emit("agent.event", {
      runId:     cp.runId,
      projectId: 0,
      phase:     "aggregation.checkpoint",
      agentName: "redis-aggregation-checkpoint-store",
      eventType: "aggregation.checkpoint.persisted" as any,
      payload:   { sessionId: cp.sessionId, checkpointId: cp.id },
      ts:        Date.now(),
    });
  }

  /**
   * Hydrate in-process fallback from Redis after a restart.
   * Called lazily on the first cache miss — no blocking path.
   */
  private async _redisLoadInto(sessionId: StreamingSessionId): Promise<void> {
    const client = await getRedisClient();
    if (!client) return;
    const raw = await client.hgetall(KEY_PREFIX + sessionId);
    if (!raw) return;
    for (const json of Object.values(raw)) {
      try {
        const cp = JSON.parse(json as string) as AggregationCheckpoint;
        this._fallback.save(cp);
      } catch { /* corrupt entry — skip */ }
    }
    bus.emit("agent.event", {
      runId:     "system",
      projectId: 0,
      phase:     "aggregation.checkpoint",
      agentName: "redis-aggregation-checkpoint-store",
      eventType: "aggregation.checkpoint.miss" as any,
      payload:   { sessionId, hydratedFromRedis: true },
      ts:        Date.now(),
    });
  }
}

export const redisAggregationCheckpointStore = new RedisAggregationCheckpointStore();
