/**
 * server/quantum/memory/run-scoped-memory-lane.ts
 *
 * RunScopedMemoryLane — isolated memory queue per run.
 *
 * Responsibilities:
 *   - Provide an isolated write queue per runId (no shared mutation)
 *   - Enforce sequential write ordering within a run
 *   - Protect concurrent write access with per-lane locking
 *   - Support replay-safe persistence (ordered sequence numbers)
 *   - Emit telemetry on all write lifecycle events
 *
 * Single responsibility: per-run write queue. No embedding / AI logic.
 */

import { bus } from "../../infrastructure/events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MemoryEntry {
  readonly seq:       number;
  readonly runId:     string;
  readonly projectId: number;
  readonly key:       string;
  readonly value:     unknown;
  readonly ts:        number;
  readonly ttl?:      number;   // ms — undefined = permanent
}

export type WriteResult = { ok: true; seq: number } | { ok: false; error: string };

export interface LaneStats {
  runId:        string;
  projectId:    number;
  entries:      number;
  totalWrites:  number;
  createdAt:    number;
  lastWriteAt:  number | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_LANE_SIZE = 1_000;

// ── Lane ──────────────────────────────────────────────────────────────────────

class MemoryLane {
  private readonly runId:     string;
  private readonly projectId: number;
  private readonly createdAt: number;
  private readonly store      = new Map<string, MemoryEntry>();
  private seq                 = 0;
  private totalWrites         = 0;
  private lastWriteAt: number | null = null;
  private _writing            = false;
  private _queue: Array<() => void> = [];

  constructor(runId: string, projectId: number) {
    this.runId     = runId;
    this.projectId = projectId;
    this.createdAt = Date.now();
  }

  async write(key: string, value: unknown, ttl?: number): Promise<WriteResult> {
    return this._serialized(async () => {
      if (this.store.size >= MAX_LANE_SIZE) {
        // Evict oldest entry
        const oldest = Array.from(this.store.values()).sort((a, b) => a.seq - b.seq)[0];
        if (oldest) this.store.delete(oldest.key);
      }

      const entry: MemoryEntry = {
        seq:       ++this.seq,
        runId:     this.runId,
        projectId: this.projectId,
        key, value, ttl,
        ts: Date.now(),
      };

      this.store.set(key, entry);
      this.totalWrites++;
      this.lastWriteAt = entry.ts;

      if (ttl !== undefined) {
        setTimeout(() => this.store.delete(key), ttl);
      }

      this._emit("lock.acquired", { resource: "memory-write", key, seq: entry.seq });
      return { ok: true as const, seq: entry.seq };
    });
  }

  read(key: string): MemoryEntry | undefined {
    return this.store.get(key);
  }

  readAll(): MemoryEntry[] {
    return Array.from(this.store.values()).sort((a, b) => a.seq - b.seq);
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  replay(sinceSeq = 0): MemoryEntry[] {
    return this.readAll().filter(e => e.seq > sinceSeq);
  }

  stats(): LaneStats {
    return {
      runId:       this.runId,
      projectId:   this.projectId,
      entries:     this.store.size,
      totalWrites: this.totalWrites,
      createdAt:   this.createdAt,
      lastWriteAt: this.lastWriteAt,
    };
  }

  destroy(): void {
    this.store.clear();
    this._queue.length = 0;
    this._emit("run.completed", { totalWrites: this.totalWrites, lifetimeMs: Date.now() - this.createdAt });
  }

  // ── Private — serialized write queue ───────────────────────────────────────

  private _serialized<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = async () => {
        this._writing = true;
        try { resolve(await fn()); } catch (e) { reject(e); } finally {
          this._writing = false;
          const next = this._queue.shift();
          if (next) next();
        }
      };
      if (this._writing) this._queue.push(run);
      else run();
    });
  }

  private _emit(eventType: string, payload: Record<string, unknown>): void {
    bus.emit("agent.event", {
      runId: this.runId, projectId: this.projectId,
      phase: "memory-lane", agentName: "run-scoped-memory-lane",
      eventType, payload, ts: Date.now(),
    });
  }
}

// ── Registry ──────────────────────────────────────────────────────────────────

const _lanes = new Map<string, MemoryLane>();  // runId → lane

// ── Public API ────────────────────────────────────────────────────────────────

export function getOrCreateLane(runId: string, projectId: number): MemoryLane {
  const existing = _lanes.get(runId);
  if (existing) return existing;
  const lane = new MemoryLane(runId, projectId);
  _lanes.set(runId, lane);
  return lane;
}

export function writeLane(runId: string, projectId: number, key: string, value: unknown, ttl?: number): Promise<WriteResult> {
  return getOrCreateLane(runId, projectId).write(key, value, ttl);
}

export function readLane(runId: string, key: string): MemoryEntry | undefined {
  return _lanes.get(runId)?.read(key);
}

export function replayLane(runId: string, sinceSeq = 0): MemoryEntry[] {
  return _lanes.get(runId)?.replay(sinceSeq) ?? [];
}

export function destroyLane(runId: string): void {
  const lane = _lanes.get(runId);
  if (!lane) return;
  lane.destroy();
  _lanes.delete(runId);
}

export function allLaneStats(): LaneStats[] {
  return Array.from(_lanes.values()).map(l => l.stats());
}

export function activeLaneCount(): number { return _lanes.size; }
