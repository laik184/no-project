/**
 * server/fail-closed/state-machine/verification-state-machine.ts
 *
 * VerificationStateMachine — the authority on system state for a single run.
 * All state transitions MUST go through this machine.
 * Illegal transitions throw immediately (fail-closed).
 *
 * No silent state mutation. Every transition is explicit and logged.
 * INVARIANT: Only CompletionAuthority may trigger VERIFIED_SUCCESS.
 */

import type { VerificationSystemState } from "../contracts/types.ts";
import {
  canTransition,
  isTerminal,
  isSuccess,
  isFailure,
  stateLabel,
} from "./states.ts";

export type StateTransitionEvent = {
  readonly from: VerificationSystemState;
  readonly to:   VerificationSystemState;
  readonly reason: string;
  readonly timestamp: number;
};

export class VerificationStateMachine {
  private _state: VerificationSystemState = "IDLE";
  private _history: StateTransitionEvent[] = [];
  private _version = 0;

  /** Attempt a transition. Throws if invalid (fail-closed). */
  transition(to: VerificationSystemState, reason: string): void {
    if (!canTransition(this._state, to)) {
      throw new Error(
        `[fail-closed] Illegal state transition: ${this._state} → ${to}. Reason: ${reason}`
      );
    }
    this._record(this._state, to, reason);
    this._state = to;
    this._version++;
  }

  /**
   * Force a terminal state regardless of current state.
   * ONLY for use by error handlers — prefer transition() everywhere else.
   */
  forceTerminal(to: Extract<VerificationSystemState, "HALTED" | "FAILED">, reason: string): void {
    this._record(this._state, to, `[FORCED] ${reason}`);
    this._state = to;
    this._version++;
  }

  /** Attempt transition without throwing — returns false if invalid. */
  tryTransition(to: VerificationSystemState, reason: string): boolean {
    if (!canTransition(this._state, to)) return false;
    this.transition(to, reason);
    return true;
  }

  get state():     VerificationSystemState   { return this._state;   }
  get version():   number                    { return this._version; }
  get isTerminal(): boolean                  { return isTerminal(this._state); }
  get isSuccess():  boolean                  { return isSuccess(this._state);  }
  get isFailure():  boolean                  { return isFailure(this._state);  }
  get label():      string                   { return stateLabel(this._state); }

  get history(): readonly StateTransitionEvent[] {
    return Object.freeze([...this._history]);
  }

  /** Returns the full path taken through states. */
  statePath(): readonly VerificationSystemState[] {
    const path: VerificationSystemState[] = ["IDLE"];
    for (const t of this._history) path.push(t.to);
    return Object.freeze(path);
  }

  /** Returns elapsed ms since the last transition. */
  msSinceLastTransition(): number {
    const last = this._history[this._history.length - 1];
    return last ? Date.now() - last.timestamp : 0;
  }

  /** True if the system went through a recovery/rollback cycle. */
  hadRecovery(): boolean {
    return this._history.some((t) => t.to === "ROLLING_BACK" || t.to === "REVERIFYING");
  }

  private _record(
    from: VerificationSystemState,
    to: VerificationSystemState,
    reason: string,
  ): void {
    this._history.push(Object.freeze({ from, to, reason, timestamp: Date.now() }));
  }
}
