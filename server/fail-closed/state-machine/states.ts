/**
 * server/fail-closed/state-machine/states.ts
 *
 * State graph for the fail-closed verification system.
 * Defines all valid transitions and which are terminal.
 * No logic — pure declarative transition table.
 *
 * The system is fail-closed: any undefined transition throws.
 * There is NO path from FAILED → VERIFIED_SUCCESS without a full REVERIFY cycle.
 */

import type { VerificationSystemState } from "../contracts/types.ts";

// ── Transition table ──────────────────────────────────────────────────────────
// Key: current state → allowed next states

export const TRANSITIONS: Readonly<Record<VerificationSystemState, readonly VerificationSystemState[]>> = {
  IDLE:                ["VERIFYING_STATIC"],
  VERIFYING_STATIC:    ["VERIFYING_BUILD",   "FAILED"],
  VERIFYING_BUILD:     ["VERIFYING_RUNTIME",  "FAILED"],
  VERIFYING_RUNTIME:   ["VERIFYING_PREVIEW",  "FAILED"],
  VERIFYING_PREVIEW:   ["RECONCILING_STATE",  "FAILED"],
  RECONCILING_STATE:   ["VERIFIED_SUCCESS",   "FAILED"],
  VERIFIED_SUCCESS:    ["IDLE"],                           // re-runnable
  FAILED:              ["RECOVERY_REQUIRED",  "HALTED"],
  RECOVERY_REQUIRED:   ["ROLLING_BACK",       "HALTED"],
  ROLLING_BACK:        ["REVERIFYING",        "HALTED"],
  REVERIFYING:         ["VERIFYING_STATIC",   "HALTED"],  // full re-pipeline
  HALTED:              [],                                  // terminal
};

// ── Terminal states (no further transitions allowed) ──────────────────────────

export const TERMINAL_STATES = new Set<VerificationSystemState>([
  "VERIFIED_SUCCESS",
  "HALTED",
]);

// ── Success states ─────────────────────────────────────────────────────────────

export const SUCCESS_STATES = new Set<VerificationSystemState>(["VERIFIED_SUCCESS"]);

// ── Failure states ─────────────────────────────────────────────────────────────

export const FAILURE_STATES = new Set<VerificationSystemState>([
  "FAILED", "RECOVERY_REQUIRED", "ROLLING_BACK", "REVERIFYING", "HALTED",
]);

// ── Stage → state mapping ──────────────────────────────────────────────────────

export const STAGE_TO_STATE: Record<string, VerificationSystemState> = {
  STATIC:               "VERIFYING_STATIC",
  BUILD:                "VERIFYING_BUILD",
  RUNTIME:              "VERIFYING_RUNTIME",
  PREVIEW:              "VERIFYING_PREVIEW",
  STATE_RECONCILIATION: "RECONCILING_STATE",
};

// ── Ordered pipeline stages ────────────────────────────────────────────────────

export const PIPELINE_STAGES = [
  "STATIC",
  "BUILD",
  "RUNTIME",
  "PREVIEW",
  "STATE_RECONCILIATION",
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

export function canTransition(from: VerificationSystemState, to: VerificationSystemState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminal(state: VerificationSystemState): boolean {
  return TERMINAL_STATES.has(state);
}

export function isSuccess(state: VerificationSystemState): boolean {
  return SUCCESS_STATES.has(state);
}

export function isFailure(state: VerificationSystemState): boolean {
  return FAILURE_STATES.has(state);
}

export function stateLabel(state: VerificationSystemState): string {
  return state.replace(/_/g, " ");
}
