/**
 * Responsibility: Redis-backed worker registry — tracks active worker processes
 *                 across nodes using Redis HSET with TTL heartbeats. Enables
 *                 cross-node worker visibility and stale-worker eviction.
 *                 Falls back to in-process tracking when Redis is absent.
 * Dependencies: redis-client, bus
 * Failure: all Redis errors degrade to in-process tracking; never throws.
 * Telemetry: emits worker.registered / worker.deregistered / worker.stale events.
 */

import { getRedisClient, isRedisAvailable } from "../redis/index.ts";
import { bus }                              from "../../infrastructure/events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type WorkerKind = "io-bound" | "cpu-bound" | "llm";
export type WorkerState = "idle" | "busy" | "draining" | "failed";

export interface WorkerRecord {
  workerId:   string;
  nodeId:     string;
  kind:       WorkerKind;
  state:      WorkerState;
  registeredAt: number;
  lastHeartbeat: number;
  tasksCompleted: number;
  tasksFailed:    number;
}

// ── Config ────────────────────────────────────────────────────────────────────

const REGISTRY_KEY    = "nura:workers:registry";
const HEARTBEAT_TTL_S = 30;    // worker considered stale after 30s without heartbeat
const SWEEP_INTERVAL  = 20_000; // evict stale workers every 20s

// ── Registry ──────────────────────────────────────────────────────────────────

class RedisWorkerRegistry {
  private readonly _local = new Map<string, WorkerRecord>();
  private _sweepTimer: ReturnType<typeof setInterval> | null = null;

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  start(): void {
    if (this._sweepTimer) return;
    this._sweepTimer = setInterval(() => this._sweepStale().catch(() => {}), SWEEP_INTERVAL);
    console.log("[redis-worker-registry] Started — heartbeat TTL:", HEARTBEAT_TTL_S, "s");
  }

  stop(): void {
    if (this._sweepTimer) { clearInterval(this._sweepTimer); this._sweepTimer = null; }
  }

  // ── Registration ────────────────────────────────────────────────────────────

  async register(record: WorkerRecord): Promise<void> {
    this._local.set(record.workerId, record);

    if (!isRedisAvailable()) return;

    try {
      const client = await getRedisClient();
      if (!client) return;

      await client.hset(REGISTRY_KEY, record.workerId, JSON.stringify(record));
      await client.expire(REGISTRY_KEY, HEARTBEAT_TTL_S * 10);

      this._emit("worker.registered", record.workerId, {
        kind:  record.kind,
        state: record.state,
        nodeId: record.nodeId,
      });
    } catch (err) {
      console.warn("[redis-worker-registry] register error:", (err as Error).message);
    }
  }

  async deregister(workerId: string): Promise<void> {
    const record = this._local.get(workerId);
    this._local.delete(workerId);

    if (!isRedisAvailable()) return;

    try {
      const client = await getRedisClient();
      if (!client) return;
      await client.hdel(REGISTRY_KEY, workerId);
      if (record) this._emit("worker.deregistered", workerId, { kind: record.kind });
    } catch (err) {
      console.warn("[redis-worker-registry] deregister error:", (err as Error).message);
    }
  }

  // ── Heartbeat ───────────────────────────────────────────────────────────────

  async heartbeat(workerId: string, state: WorkerState): Promise<void> {
    const local = this._local.get(workerId);
    if (local) {
      local.lastHeartbeat = Date.now();
      local.state = state;
    }

    if (!isRedisAvailable()) return;

    try {
      const client = await getRedisClient();
      if (!client) return;

      const stored = await client.hget(REGISTRY_KEY, workerId);
      if (!stored) return;

      const record = JSON.parse(stored) as WorkerRecord;
      record.lastHeartbeat = Date.now();
      record.state = state;

      await client.hset(REGISTRY_KEY, workerId, JSON.stringify(record));
    } catch { /* heartbeat errors are non-fatal */ }
  }

  async recordCompletion(workerId: string, success: boolean): Promise<void> {
    const local = this._local.get(workerId);
    if (local) {
      if (success) local.tasksCompleted++;
      else         local.tasksFailed++;
    }
  }

  // ── Query ───────────────────────────────────────────────────────────────────

  async list(): Promise<WorkerRecord[]> {
    if (!isRedisAvailable()) {
      return [...this._local.values()];
    }

    try {
      const client = await getRedisClient();
      if (!client) return [...this._local.values()];

      const raw = await client.hgetall(REGISTRY_KEY);
      if (!raw) return [];

      return Object.values(raw).map(json => {
        try { return JSON.parse(json) as WorkerRecord; }
        catch { return null; }
      }).filter((r): r is WorkerRecord => r !== null);
    } catch {
      return [...this._local.values()];
    }
  }

  localStats(): { total: number; byKind: Record<string, number>; byState: Record<string, number> } {
    const byKind:  Record<string, number> = {};
    const byState: Record<string, number> = {};

    for (const r of this._local.values()) {
      byKind[r.kind]   = (byKind[r.kind]   ?? 0) + 1;
      byState[r.state] = (byState[r.state] ?? 0) + 1;
    }
    return { total: this._local.size, byKind, byState };
  }

  // ── Stale sweep ─────────────────────────────────────────────────────────────

  private async _sweepStale(): Promise<void> {
    const cutoff = Date.now() - HEARTBEAT_TTL_S * 1_000;

    // In-process sweep
    for (const [id, r] of this._local) {
      if (r.lastHeartbeat < cutoff) {
        this._local.delete(id);
        this._emit("worker.stale", id, { kind: r.kind, lastHeartbeat: r.lastHeartbeat });
      }
    }

    if (!isRedisAvailable()) return;

    try {
      const client = await getRedisClient();
      if (!client) return;

      const raw = await client.hgetall(REGISTRY_KEY);
      if (!raw) return;

      for (const [workerId, json] of Object.entries(raw)) {
        try {
          const record = JSON.parse(json) as WorkerRecord;
          if (record.lastHeartbeat < cutoff) {
            await client.hdel(REGISTRY_KEY, workerId);
            this._emit("worker.stale", workerId, { kind: record.kind, lastHeartbeat: record.lastHeartbeat });
          }
        } catch { /* corrupt entry — skip */ }
      }
    } catch (err) {
      console.warn("[redis-worker-registry] sweep error:", (err as Error).message);
    }
  }

  // ── Telemetry ────────────────────────────────────────────────────────────────

  private _emit(eventType: string, workerId: string, payload: Record<string, unknown>): void {
    try {
      bus.emit("agent.event", {
        runId:     "system",
        projectId: 0,
        phase:     "distributed.workers",
        agentName: "redis-worker-registry",
        eventType: eventType as any,
        payload:   { workerId, ...payload },
        ts:        Date.now(),
      });
    } catch { /* non-fatal */ }
  }
}

export const redisWorkerRegistry = new RedisWorkerRegistry();
