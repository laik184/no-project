/**
 * server/orchestration/distributed/run-scoped-orchestrator.ts
 *
 * Run-scoped orchestrator: manages per-run phase state machine,
 * checkpoint history, recovery, and metadata isolation.
 * Orchestration-only — no tool execution, no filesystem access.
 */

import { bus } from '../../infrastructure/events/bus.ts';

// ── Phase types ───────────────────────────────────────────────────────────────

export type RunPhase =
  | 'observe'
  | 'analyze'
  | 'plan'
  | 'execute'
  | 'complete'
  | 'failed'
  | 'recovering';

// ── Allowed transitions ───────────────────────────────────────────────────────

const TRANSITIONS: Partial<Record<RunPhase, RunPhase[]>> = {
  observe:    ['analyze', 'plan', 'execute', 'complete', 'failed'],
  analyze:    ['plan', 'execute', 'complete', 'failed'],
  plan:       ['execute', 'complete', 'failed'],
  execute:    ['complete', 'failed', 'recovering'],
  recovering: ['execute', 'plan', 'failed'],
  complete:   [],
  failed:     [],
};

const TERMINAL: Set<RunPhase> = new Set(['complete', 'failed']);

// ── Checkpoint ────────────────────────────────────────────────────────────────

export interface Checkpoint {
  phase:     RunPhase;
  timestamp: Date;
}

// ── Transition result ─────────────────────────────────────────────────────────

export interface TransitionResult {
  ok:     boolean;
  error?: string;
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

export interface RunOrchestratorSnapshot {
  runId:       string;
  projectId:   number;
  phase:       RunPhase;
  isTerminal:  boolean;
  failCount:   number;
  checkpoints: Checkpoint[];
  meta:        Record<string, unknown>;
}

// ── Class ─────────────────────────────────────────────────────────────────────

export class RunScopedOrchestrator {
  readonly runId:     string;
  readonly projectId: number;

  private _phase:       RunPhase = 'observe';
  private _failCount:   number   = 0;
  private _checkpoints: Checkpoint[] = [];
  private _meta:        Map<string, unknown> = new Map();

  constructor(runId: string, projectId: number) {
    this.runId     = runId;
    this.projectId = projectId;
  }

  // ── State ─────────────────────────────────────────────────────────────────

  get phase(): RunPhase {
    return this._phase;
  }

  get isTerminal(): boolean {
    return TERMINAL.has(this._phase);
  }

  // ── Transitions ───────────────────────────────────────────────────────────

  transition(to: RunPhase): TransitionResult {
    if (this.isTerminal) {
      return { ok: false, error: `Cannot transition from terminal phase "${this._phase}"` };
    }
    const allowed = TRANSITIONS[this._phase] ?? [];
    if (!allowed.includes(to)) {
      return {
        ok:    false,
        error: `Invalid transition "${this._phase}" → "${to}". Allowed: [${allowed.join(', ')}]`,
      };
    }
    this._phase = to;
    this._checkpoints.push({ phase: to, timestamp: new Date() });
    this._emitPhaseEvent(to);
    return { ok: true };
  }

  fail(reason: string): void {
    this._failCount++;
    this._phase = 'failed';
    this._checkpoints.push({ phase: 'failed', timestamp: new Date() });
    bus.emit('agent.event', {
      runId:   this.runId,
      phase:   'failed',
      reason,
      message: `Run ${this.runId} failed: ${reason}`,
    } as never);
  }

  recover(reason: string): TransitionResult {
    if (this.isTerminal) {
      return { ok: false, error: `Cannot recover from terminal phase "${this._phase}"` };
    }
    this._failCount++;
    this._phase = 'recovering';
    this._checkpoints.push({ phase: 'recovering', timestamp: new Date() });
    bus.emit('agent.event', {
      runId:   this.runId,
      phase:   'recovering',
      reason,
      message: `Run ${this.runId} recovering: ${reason}`,
    } as never);
    return { ok: true };
  }

  // ── Checkpoints ───────────────────────────────────────────────────────────

  latestCheckpoint(): Checkpoint | undefined {
    return this._checkpoints.at(-1);
  }

  lastCheckpointBefore(phase: RunPhase): Checkpoint | undefined {
    const idx = [...this._checkpoints].reverse().findIndex(c => c.phase === phase);
    if (idx === -1) return undefined;
    const beforeIdx = this._checkpoints.length - 1 - idx - 1;
    return beforeIdx >= 0 ? this._checkpoints[beforeIdx] : undefined;
  }

  snapshot(): RunOrchestratorSnapshot {
    return {
      runId:       this.runId,
      projectId:   this.projectId,
      phase:       this._phase,
      isTerminal:  this.isTerminal,
      failCount:   this._failCount,
      checkpoints: [...this._checkpoints],
      meta:        Object.fromEntries(this._meta),
    };
  }

  // ── Metadata ──────────────────────────────────────────────────────────────

  setMeta(key: string, value: unknown): void {
    this._meta.set(key, value);
  }

  getMeta(key: string): unknown {
    return this._meta.get(key);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _emitPhaseEvent(phase: RunPhase): void {
    bus.emit('agent.event', {
      runId:   this.runId,
      phase,
      message: `Run ${this.runId} → phase:${phase}`,
    } as never);
  }
}
