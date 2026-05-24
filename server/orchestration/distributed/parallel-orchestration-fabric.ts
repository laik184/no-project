/**
 * server/orchestration/distributed/parallel-orchestration-fabric.ts
 *
 * ParallelOrchestrationFabric — multi-run orchestration coordinator.
 *
 * Responsibilities:
 *   - Spawn and register isolated RunScopedOrchestrators per run
 *   - Enforce concurrency limits to prevent system overload
 *   - Coordinate parallel DAG execution across runs
 *   - Prevent cross-run state mutation
 *   - Emit fabric-level telemetry on all lifecycle events
 *   - Garbage-collect completed orchestrators
 *
 * Single responsibility: orchestrator lifecycle registry. No agent/runtime logic.
 */

import { RunScopedOrchestrator, type RunPhase } from "./run-scoped-orchestrator.ts";
import { bus }                                   from "../../infrastructure/events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FabricConfig {
  maxConcurrentRuns: number;   // hard cap — default 20
  gcIntervalMs:      number;   // how often to sweep terminal orchestrators
}

export interface FabricSnapshot {
  active:      number;
  completed:   number;
  failed:      number;
  capacity:    number;
  pressure:    number;          // 0–1 — active / maxConcurrentRuns
}

export type SpawnResult =
  | { ok: true;  orchestrator: RunScopedOrchestrator }
  | { ok: false; error: string };

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: FabricConfig = {
  maxConcurrentRuns: 20,
  gcIntervalMs:      60_000,
};

// ── ParallelOrchestrationFabric ───────────────────────────────────────────────

class ParallelOrchestrationFabric {
  private readonly orchestrators = new Map<string, RunScopedOrchestrator>();
  private readonly cfg:           FabricConfig;
  private gcTimer:                NodeJS.Timeout | null = null;
  private completedCount          = 0;
  private failedCount             = 0;

  constructor(cfg: Partial<FabricConfig> = {}) {
    this.cfg = { ...DEFAULT_CONFIG, ...cfg };
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  start(): void {
    if (this.gcTimer) return;
    this.gcTimer = setInterval(() => this._gc(), this.cfg.gcIntervalMs);
    this.gcTimer.unref?.();
    this._emit("fabric.started", { maxConcurrentRuns: this.cfg.maxConcurrentRuns });
  }

  stop(): void {
    if (this.gcTimer) { clearInterval(this.gcTimer); this.gcTimer = null; }
    this._emit("fabric.stopped", { active: this.orchestrators.size });
  }

  // ── Run management ─────────────────────────────────────────────────────────

  /**
   * Spawn a new isolated orchestrator for a run.
   * Enforces capacity limits — rejects if maxConcurrentRuns exceeded.
   * Idempotent — returns existing orchestrator if run is already active.
   */
  spawn(runId: string, projectId: number): SpawnResult {
    const existing = this.orchestrators.get(runId);
    if (existing && !existing.isTerminal) return { ok: true, orchestrator: existing };

    const active = this._activeCount();
    if (active >= this.cfg.maxConcurrentRuns) {
      this._emit("conflict.detected", {
        reason:    "capacity-exceeded",
        active,
        maxConcurrentRuns: this.cfg.maxConcurrentRuns,
        rejectedRunId: runId,
      });
      return { ok: false, error: `Fabric at capacity: ${active}/${this.cfg.maxConcurrentRuns} concurrent runs` };
    }

    const orch = new RunScopedOrchestrator(runId, projectId);
    this.orchestrators.set(runId, orch);
    this._emit("run.started", { runId, projectId, active: active + 1 });
    return { ok: true, orchestrator: orch };
  }

  /**
   * Transition a run's phase via its orchestrator.
   * No-ops gracefully if runId is unknown.
   */
  transition(runId: string, phase: RunPhase, payload: Record<string, unknown> = {}) {
    return this.orchestrators.get(runId)?.transition(phase, payload);
  }

  /** Mark a run as failed. */
  fail(runId: string, reason: string, context: Record<string, unknown> = {}): void {
    const orch = this.orchestrators.get(runId);
    if (!orch) return;
    orch.fail(reason, context);
    this.failedCount++;
  }

  /** Retrieve an orchestrator by runId (read-only). */
  get(runId: string): RunScopedOrchestrator | undefined {
    return this.orchestrators.get(runId);
  }

  /** Whether a run is currently active. */
  isActive(runId: string): boolean {
    const o = this.orchestrators.get(runId);
    return !!o && !o.isTerminal;
  }

  // ── Monitoring ─────────────────────────────────────────────────────────────

  snapshot(): FabricSnapshot {
    const active = this._activeCount();
    return {
      active,
      completed: this.completedCount,
      failed:    this.failedCount,
      capacity:  this.cfg.maxConcurrentRuns,
      pressure:  active / this.cfg.maxConcurrentRuns,
    };
  }

  allRunIds(): string[] {
    return Array.from(this.orchestrators.keys());
  }

  activeRunIds(): string[] {
    return Array.from(this.orchestrators.entries())
      .filter(([, o]) => !o.isTerminal)
      .map(([id]) => id);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _activeCount(): number {
    return Array.from(this.orchestrators.values()).filter(o => !o.isTerminal).length;
  }

  private _gc(): void {
    let collected = 0;
    for (const [runId, orch] of this.orchestrators) {
      if (orch.isTerminal) {
        const snap = orch.snapshot();
        if (snap.completedAt && (Date.now() - snap.completedAt) > 300_000) {
          if (snap.phase === "complete") this.completedCount++;
          else this.failedCount++;
          this.orchestrators.delete(runId);
          collected++;
        }
      }
    }
    if (collected > 0) {
      this._emit("fabric.gc", { collected, remaining: this.orchestrators.size });
    }
  }

  private _emit(eventType: string, payload: Record<string, unknown>): void {
    bus.emit("agent.event", {
      runId: "fabric",
      projectId: 0,
      phase: "parallel-orchestration",
      agentName: "parallel-orchestration-fabric",
      eventType, payload,
      ts: Date.now(),
    });
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const parallelOrchestrationFabric = new ParallelOrchestrationFabric();
