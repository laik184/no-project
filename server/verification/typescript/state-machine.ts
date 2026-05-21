/**
 * server/verification/typescript/state-machine.ts
 *
 * VerificationStateMachine — explicit, deterministic state transitions.
 * No implicit mutation. Every transition is validated against the allowed graph.
 */

import type { VerificationState } from "./types.ts";

// ─── Allowed transition graph ─────────────────────────────────────────────────

const TRANSITIONS: Record<VerificationState, readonly VerificationState[]> = {
  IDLE:       ["STARTING"],
  STARTING:   ["RUNNING", "FAILED", "CANCELLED"],
  RUNNING:    ["PARSING", "TIMEOUT", "FAILED", "CANCELLED"],
  PARSING:    ["PASSED", "FAILED", "CORRUPTED"],
  PASSED:     [],
  FAILED:     [],
  TIMEOUT:    [],
  CANCELLED:  [],
  CORRUPTED:  [],
};

// ─── Terminal states — no further transitions ─────────────────────────────────

const TERMINAL_STATES = new Set<VerificationState>([
  "PASSED",
  "FAILED",
  "TIMEOUT",
  "CANCELLED",
  "CORRUPTED",
]);

// ─── State machine ────────────────────────────────────────────────────────────

export class VerificationStateMachine {
  private _state: VerificationState = "IDLE";
  private _history: Array<{ state: VerificationState; ts: number }> = [
    { state: "IDLE", ts: Date.now() },
  ];

  get state(): VerificationState {
    return this._state;
  }

  get history(): ReadonlyArray<{ state: VerificationState; ts: number }> {
    return this._history;
  }

  get isTerminal(): boolean {
    return TERMINAL_STATES.has(this._state);
  }

  transition(next: VerificationState): void {
    const allowed = TRANSITIONS[this._state];
    if (!allowed.includes(next)) {
      throw new StateMachineError(
        `Illegal transition: ${this._state} → ${next}. Allowed: [${allowed.join(", ")}]`,
        this._state,
        next
      );
    }
    this._state = next;
    this._history.push({ state: next, ts: Date.now() });
  }

  tryTransition(next: VerificationState): boolean {
    const allowed = TRANSITIONS[this._state];
    if (!allowed.includes(next)) return false;
    this._state = next;
    this._history.push({ state: next, ts: Date.now() });
    return true;
  }

  forceTerminal(state: VerificationState): void {
    if (!TERMINAL_STATES.has(state)) {
      throw new Error(`forceTerminal called with non-terminal state: ${state}`);
    }
    this._state = state;
    this._history.push({ state, ts: Date.now() });
  }

  reset(): void {
    this._state = "IDLE";
    this._history = [{ state: "IDLE", ts: Date.now() }];
  }
}

// ─── Custom error ─────────────────────────────────────────────────────────────

export class StateMachineError extends Error {
  constructor(
    message: string,
    public readonly from: VerificationState,
    public readonly to: VerificationState
  ) {
    super(message);
    this.name = "StateMachineError";
  }
}
