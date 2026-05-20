import type { SafetyDecision } from "./types";

export interface SafetyHistoryEntry {
  readonly action: string;
  readonly decision: SafetyDecision;
  readonly riskScore: number;
  readonly threats: readonly string[];
  readonly isAdmin: boolean;
  readonly recordedAt: number;
}

export interface GlobalSafetyStateShape {
  readonly lastRiskScore: number;
  readonly blockedActions: number;
  readonly allowedActions: number;
  readonly lastDecision: SafetyDecision;
  readonly history: readonly SafetyHistoryEntry[];
}

const initialState: GlobalSafetyStateShape = Object.freeze({
  lastRiskScore: 0,
  blockedActions: 0,
  allowedActions: 0,
  lastDecision: "ALLOW",
  history: Object.freeze([]) as readonly SafetyHistoryEntry[],
});

let mutableState: GlobalSafetyStateShape = initialState;

export function getSafetyState(): GlobalSafetyStateShape {
  return mutableState;
}

export function recordDecision(
  action: string,
  decision: SafetyDecision,
  riskScore: number,
  threats: string[],
  isAdmin: boolean
): void {
  const entry: SafetyHistoryEntry = Object.freeze({
    action: action.slice(0, 500),
    decision,
    riskScore,
    threats: Object.freeze([...threats]),
    isAdmin,
    recordedAt: Date.now(),
  });

  const history = [...mutableState.history, entry].slice(-500);

  mutableState = Object.freeze({
    lastRiskScore: riskScore,
    blockedActions: mutableState.blockedActions + (decision === "BLOCK" ? 1 : 0),
    allowedActions: mutableState.allowedActions + (decision === "ALLOW" ? 1 : 0),
    lastDecision: decision,
    history: Object.freeze(history),
  });
}

export function resetSafetyState(): void {
  mutableState = initialState;
}
