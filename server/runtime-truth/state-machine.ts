/**
 * server/runtime-truth/state-machine.ts
 *
 * RuntimeStateMachine — explicit, guarded, versioned state transitions.
 * StateTransitionGuard — rejects illegal transitions before they apply.
 * No implicit state mutation anywhere outside this module.
 */

import type { RuntimeHealthState } from "./types.ts";

// ─── Legal transition graph ───────────────────────────────────────────────────

const GRAPH: Record<RuntimeHealthState, readonly RuntimeHealthState[]> = {
  UNKNOWN:    ["STARTING", "FAILED", "HALTED"],
  STARTING:   ["RUNNING", "FAILED", "HALTED", "UNKNOWN"],
  RUNNING:    ["VERIFYING", "DEGRADED", "FAILED", "HALTED", "RECOVERING"],
  DEGRADED:   ["RUNNING", "VERIFYING", "FAILED", "HALTED", "RECOVERING"],
  VERIFYING:  ["VERIFIED", "FAILED", "DEGRADED", "HALTED"],
  VERIFIED:   ["RUNNING", "DEGRADED", "VERIFYING", "HALTED"],
  FAILED:     ["RECOVERING", "HALTED", "STARTING"],
  RECOVERING: ["RUNNING", "FAILED", "HALTED", "STARTING"],
  HALTED:     [],
};

const TERMINAL: ReadonlySet<RuntimeHealthState> = new Set(["HALTED"]);

// ─── Audit entry ──────────────────────────────────────────────────────────────

export interface TransitionRecord {
  readonly from: RuntimeHealthState;
  readonly to: RuntimeHealthState;
  readonly reason: string;
  readonly version: number;
  readonly ts: number;
}

// ─── Guard ────────────────────────────────────────────────────────────────────

export class StateTransitionGuard {
  validate(from: RuntimeHealthState, to: RuntimeHealthState): void {
    const allowed = GRAPH[from];
    if (!allowed.includes(to)) {
      throw new IllegalTransitionError(from, to, allowed);
    }
  }

  isLegal(from: RuntimeHealthState, to: RuntimeHealthState): boolean {
    return GRAPH[from].includes(to);
  }

  allowedFrom(state: RuntimeHealthState): readonly RuntimeHealthState[] {
    return GRAPH[state];
  }

  isTerminal(state: RuntimeHealthState): boolean {
    return TERMINAL.has(state);
  }
}

// ─── State machine ────────────────────────────────────────────────────────────

export class RuntimeStateMachine {
  private _state: RuntimeHealthState = "UNKNOWN";
  private _version = 0;
  private _log: TransitionRecord[] = [];
  private readonly _guard = new StateTransitionGuard();

  get state(): RuntimeHealthState { return this._state; }
  get version(): number { return this._version; }
  get isTerminal(): boolean { return this._guard.isTerminal(this._state); }
  get log(): ReadonlyArray<TransitionRecord> { return this._log; }

  transition(to: RuntimeHealthState, reason: string): TransitionRecord {
    this._guard.validate(this._state, to);
    const record: TransitionRecord = Object.freeze({
      from: this._state,
      to,
      reason,
      version: ++this._version,
      ts: Date.now(),
    });
    this._state = to;
    this._log.push(record);
    if (this._log.length > 200) this._log.shift();
    return record;
  }

  tryTransition(to: RuntimeHealthState, reason: string): TransitionRecord | null {
    if (!this._guard.isLegal(this._state, to)) return null;
    return this.transition(to, reason);
  }

  forceState(to: RuntimeHealthState, reason: string): void {
    const record: TransitionRecord = Object.freeze({
      from: this._state, to, reason,
      version: ++this._version, ts: Date.now(),
    });
    this._state = to;
    this._log.push(record);
  }

  reset(): void {
    this._state = "UNKNOWN";
    this._version = 0;
    this._log = [];
  }
}

// ─── Error ────────────────────────────────────────────────────────────────────

export class IllegalTransitionError extends Error {
  constructor(
    public readonly from: RuntimeHealthState,
    public readonly to: RuntimeHealthState,
    public readonly allowed: readonly RuntimeHealthState[]
  ) {
    super(
      `Illegal state transition: ${from} → ${to}. Allowed: [${allowed.join(", ")}]`
    );
    this.name = "IllegalTransitionError";
  }
}
