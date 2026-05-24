/**
 * server/orchestration/distributed/run-scoped-orchestrator.ts
 *
 * RunScopedOrchestrator — fully isolated orchestration unit for a single run.
 *
 * Responsibilities:
 *   - Own the complete execution lifecycle for exactly one run
 *   - Maintain isolated checkpoint history
 *   - Manage isolated DAG phase state
 *   - Coordinate isolated recovery without cross-run pollution
 *   - Emit lifecycle telemetry on every phase transition
 *
 * Single responsibility: per-run orchestration state machine. No agent logic.
 */

import { bus }       from "../../infrastructure/events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RunPhase =
  | "pending" | "observe" | "analyze" | "plan" | "route"
  | "execute" | "verify"  | "browser" | "reflect" | "score"
  | "learn"   | "complete" | "failed" | "recovering";

export interface RunCheckpoint {
  readonly phase:     RunPhase;
  readonly ts:        number;
  readonly seq:       number;
  payload:            Record<string, unknown>;
}

export interface RunOrchestratorState {
  runId:        string;
  projectId:    number;
  phase:        RunPhase;
  startedAt:    number;
  completedAt?: number;
  checkpoints:  RunCheckpoint[];
  failCount:    number;
  meta:         Map<string, unknown>;
}

export type PhaseTransitionResult = { ok: true } | { ok: false; error: string };

// ── RunScopedOrchestrator ────────────────────────────────────────────────────

export class RunScopedOrchestrator {
  private readonly state: RunOrchestratorState;
  private seq = 0;

  constructor(runId: string, projectId: number) {
    this.state = {
      runId, projectId,
      phase:       "pending",
      startedAt:   Date.now(),
      checkpoints: [],
      failCount:   0,
      meta:        new Map(),
    };
    this._emit("run.started", { runId, projectId });
  }

  // ── Phase management ───────────────────────────────────────────────────────

  /** Advance to a new phase, recording a checkpoint. */
  transition(phase: RunPhase, payload: Record<string, unknown> = {}): PhaseTransitionResult {
    const prev = this.state.phase;

    if (prev === "complete" || prev === "failed") {
      return { ok: false, error: `Cannot transition from terminal phase ${prev}` };
    }

    const checkpoint: RunCheckpoint = {
      phase, ts: Date.now(), seq: ++this.seq, payload,
    };
    this.state.checkpoints.push(checkpoint);
    this.state.phase = phase;

    this._emit(`run.phase.${phase}`, { prev, phase, seq: this.seq, ...payload });

    if (phase === "complete" || phase === "failed") {
      this.state.completedAt = Date.now();
      this._emit(phase === "complete" ? "run.completed" : "runtime.failed", {
        durationMs: this.state.completedAt - this.state.startedAt,
        phases: this.state.checkpoints.length,
        failCount: this.state.failCount,
      });
    }

    return { ok: true };
  }

  /** Mark run as failed with context, increment fail counter. */
  fail(reason: string, context: Record<string, unknown> = {}): void {
    this.state.failCount++;
    this.transition("failed", { reason, failCount: this.state.failCount, ...context });
  }

  /** Enter recovery mode (does not count as a failure). */
  recover(reason: string): PhaseTransitionResult {
    this._emit("recovery.triggered", { reason, runId: this.state.runId });
    return this.transition("recovering", { reason });
  }

  // ── Checkpoint access ──────────────────────────────────────────────────────

  /** Get the last checkpoint before a given phase (for rollback). */
  lastCheckpointBefore(phase: RunPhase): RunCheckpoint | undefined {
    const idx = this.state.checkpoints.findIndex(c => c.phase === phase);
    return idx > 0 ? this.state.checkpoints[idx - 1] : undefined;
  }

  /** Latest checkpoint. */
  latestCheckpoint(): RunCheckpoint | undefined {
    return this.state.checkpoints.at(-1);
  }

  // ── Metadata ───────────────────────────────────────────────────────────────

  setMeta(key: string, value: unknown): void { this.state.meta.set(key, value); }
  getMeta<T = unknown>(key: string): T | undefined { return this.state.meta.get(key) as T; }

  // ── Read-only state ────────────────────────────────────────────────────────

  get runId():     string   { return this.state.runId; }
  get projectId(): number   { return this.state.projectId; }
  get phase():     RunPhase { return this.state.phase; }
  get isTerminal(): boolean { return this.state.phase === "complete" || this.state.phase === "failed"; }

  snapshot(): RunOrchestratorState {
    return {
      ...this.state,
      checkpoints: [...this.state.checkpoints],
      meta: new Map(this.state.meta),
    };
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _emit(eventType: string, payload: Record<string, unknown>): void {
    bus.emit("agent.event", {
      runId:     this.state.runId,
      projectId: this.state.projectId,
      phase:     this.state.phase,
      agentName: "run-scoped-orchestrator",
      eventType,
      payload,
      ts: Date.now(),
    });
  }
}
