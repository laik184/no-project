/**
 * Responsibility: Redis-backed replay journal persistence using LPUSH/LRANGE.
 *                 Replaces the in-process Map in replay-journal.ts for multi-node
 *                 distributed replay. Falls back to in-process journal when Redis
 *                 is absent so the contract is always met.
 * Dependencies: redis-client, bus
 * Failure: all Redis errors fall through to in-process fallback; never throws.
 * Telemetry: emits replay.persisted / replay.hydrated events.
 */

import { getRedisClient, isRedisAvailable } from "../../distributed/redis/index.ts";
import { bus }                              from "../events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReplayEntry {
  id:         string;
  runId:      string;
  txId:       string;
  filePath:   string;
  operation:  string;
  content?:   string;
  strategy:   string;
  confidence: number;
  recordedAt: number;
}

// ── Config ────────────────────────────────────────────────────────────────────

const KEY_PREFIX  = "nura:replay:";
const TTL_SECS    = 86_400;   // 24 hours — replay windows are bounded
const MAX_ENTRIES = 10_000;   // LTRIM cap per run to prevent unbounded growth

// ── Redis replay store ────────────────────────────────────────────────────────

class RedisReplayStore {
  /** In-process fallback when Redis is unavailable */
  private readonly _local = new Map<string, ReplayEntry[]>();

  // ── Write ──────────────────────────────────────────────────────────────────

  async append(entry: ReplayEntry): Promise<void> {
    // Always write locally first (guaranteed sync path)
    const list = this._local.get(entry.runId) ?? [];
    list.push(entry);
    this._local.set(entry.runId, list);

    if (!isRedisAvailable()) return;

    try {
      const client = await getRedisClient();
      if (!client) return;

      const key = KEY_PREFIX + entry.runId;
      await client.rpush(key, JSON.stringify(entry));
      await client.ltrim(key, -MAX_ENTRIES, -1);  // keep last N entries
      await client.expire(key, TTL_SECS);

      bus.emit("agent.event", {
        runId:     entry.runId,
        projectId: 0,
        phase:     "replay.journal",
        agentName: "redis-replay-store",
        eventType: "replay.persisted" as any,
        payload:   { entryId: entry.id, filePath: entry.filePath, strategy: entry.strategy },
        ts:        Date.now(),
      });
    } catch (err) {
      console.warn("[redis-replay-store] append error:", (err as Error).message);
    }
  }

  async appendBatch(entries: ReplayEntry[]): Promise<void> {
    await Promise.all(entries.map(e => this.append(e)));
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  async load(runId: string): Promise<ReplayEntry[]> {
    // Try in-process first (live sessions are always current)
    const local = this._local.get(runId);
    if (local?.length) return [...local];

    if (!isRedisAvailable()) return [];

    try {
      const client = await getRedisClient();
      if (!client) return [];

      const raw = await client.lrange(KEY_PREFIX + runId, 0, -1);
      if (!raw.length) return [];

      const entries: ReplayEntry[] = [];
      for (const json of raw) {
        try { entries.push(JSON.parse(json) as ReplayEntry); }
        catch { /* corrupt entry — skip */ }
      }

      // Hydrate local cache for future in-process reads
      this._local.set(runId, entries);

      bus.emit("agent.event", {
        runId,
        projectId: 0,
        phase:     "replay.journal",
        agentName: "redis-replay-store",
        eventType: "replay.hydrated" as any,
        payload:   { runId, entryCount: entries.length, source: "redis" },
        ts:        Date.now(),
      });

      return entries;
    } catch (err) {
      console.warn("[redis-replay-store] load error:", (err as Error).message);
      return [];
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  async purge(runId: string): Promise<number> {
    const count = this._local.get(runId)?.length ?? 0;
    this._local.delete(runId);

    if (isRedisAvailable()) {
      try {
        const client = await getRedisClient();
        await client?.del(KEY_PREFIX + runId);
      } catch { /* ignore */ }
    }
    return count;
  }

  // ── Health ─────────────────────────────────────────────────────────────────

  stats(): { backend: string; localRuns: number; localEntries: number } {
    let localEntries = 0;
    for (const entries of this._local.values()) localEntries += entries.length;
    return {
      backend:      isRedisAvailable() ? "redis" : "in-process",
      localRuns:    this._local.size,
      localEntries,
    };
  }
}

export const redisReplayStore = new RedisReplayStore();
