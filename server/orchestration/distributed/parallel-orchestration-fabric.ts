/**
 * server/orchestration/distributed/parallel-orchestration-fabric.ts
 *
 * Manages a pool of isolated RunScopedOrchestrators running in parallel.
 * Enforces capacity limits, provides GC for terminal runs, and exposes
 * a unified control surface for the distributed orchestration layer.
 * Orchestration-only — no tool execution, no filesystem access.
 */

import { RunScopedOrchestrator } from './run-scoped-orchestrator.ts';
import type { RunPhase } from './run-scoped-orchestrator.ts';
import { bus } from '../../infrastructure/events/bus.ts';

// ── Capacity config ───────────────────────────────────────────────────────────

const DEFAULT_CAPACITY = 32;

// ── Spawn result ──────────────────────────────────────────────────────────────

export type SpawnResult =
  | { ok: true;  orchestrator: RunScopedOrchestrator }
  | { ok: false; error: string };

// ── Fabric snapshot ───────────────────────────────────────────────────────────

export interface FabricSnapshot {
  capacity:    number;
  active:      number;
  pressure:    number;
  runIds:      string[];
}

// ── Parallel orchestration fabric ─────────────────────────────────────────────

class ParallelOrchestrationFabric {
  private _pool:     Map<string, RunScopedOrchestrator> = new Map();
  private _capacity: number = DEFAULT_CAPACITY;
  private _gcTimer:  ReturnType<typeof setInterval> | undefined;
  private _running:  boolean = false;

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  start(capacity: number = DEFAULT_CAPACITY): void {
    if (this._running) return;
    this._running  = true;
    this._capacity = capacity;
    // GC terminal runs every 30 seconds
    this._gcTimer = setInterval(() => this._gc(), 30_000);
    console.log(`[parallel-fabric] Started — capacity=${this._capacity}`);
  }

  stop(): void {
    if (!this._running) return;
    this._running = false;
    if (this._gcTimer) {
      clearInterval(this._gcTimer);
      this._gcTimer = undefined;
    }
    this._pool.clear();
    console.log('[parallel-fabric] Stopped — pool cleared');
  }

  // ── Spawn ───────────────────────────────────────────────────────────────────

  spawn(runId: string, projectId: number): SpawnResult {
    // Idempotent — return existing if active
    const existing = this._pool.get(runId);
    if (existing && !existing.isTerminal) {
      return { ok: true, orchestrator: existing };
    }

    if (this._activeCount() >= this._capacity) {
      return {
        ok:    false,
        error: `Parallel fabric at capacity (${this._capacity}) — cannot spawn runId=${runId}`,
      };
    }

    const orch = new RunScopedOrchestrator(runId, projectId);
    this._pool.set(runId, orch);

    bus.emit('agent.event', {
      runId,
      message: `[parallel-fabric] Spawned orchestrator for run ${runId}`,
    } as never);

    return { ok: true, orchestrator: orch };
  }

  // ── Control surface ─────────────────────────────────────────────────────────

  get(runId: string): RunScopedOrchestrator | undefined {
    return this._pool.get(runId);
  }

  transition(runId: string, phase: RunPhase): { ok: boolean; error?: string } {
    const orch = this._pool.get(runId);
    if (!orch) return { ok: false, error: `No orchestrator for runId=${runId}` };
    return orch.transition(phase);
  }

  fail(runId: string, reason: string): void {
    const orch = this._pool.get(runId);
    if (orch) orch.fail(reason);
  }

  isActive(runId: string): boolean {
    const orch = this._pool.get(runId);
    return orch !== undefined && !orch.isTerminal;
  }

  activeRunIds(): string[] {
    const ids: string[] = [];
    for (const [id, orch] of this._pool) {
      if (!orch.isTerminal) ids.push(id);
    }
    return ids;
  }

  // ── Snapshot ────────────────────────────────────────────────────────────────

  snapshot(): FabricSnapshot {
    const active = this._activeCount();
    return {
      capacity: this._capacity,
      active,
      pressure: active / this._capacity,
      runIds:   this.activeRunIds(),
    };
  }

  // ── GC ──────────────────────────────────────────────────────────────────────

  private _gc(): void {
    let evicted = 0;
    for (const [id, orch] of this._pool) {
      if (orch.isTerminal) {
        this._pool.delete(id);
        evicted++;
      }
    }
    if (evicted > 0) {
      console.log(`[parallel-fabric] GC evicted ${evicted} terminal orchestrators`);
    }
  }

  private _activeCount(): number {
    let count = 0;
    for (const orch of this._pool.values()) {
      if (!orch.isTerminal) count++;
    }
    return count;
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────

export const parallelOrchestrationFabric = new ParallelOrchestrationFabric();
