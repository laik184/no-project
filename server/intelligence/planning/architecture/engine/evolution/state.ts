import type { ArchitectureEvolutionPlan, EvolutionState } from "./types.js";

let evolutionState: EvolutionState | null = null;
let lastPlan: ArchitectureEvolutionPlan | null = null;

export function setEvolutionState(state: EvolutionState): void {
  evolutionState = Object.freeze({ ...state });
}

export function getEvolutionState(): Readonly<EvolutionState> | null {
  return evolutionState;
}

export function setLastPlan(plan: ArchitectureEvolutionPlan): void {
  lastPlan = Object.freeze({ ...plan });
}

export function getLastPlan(): Readonly<ArchitectureEvolutionPlan> | null {
  return lastPlan;
}

export function clearEvolutionState(): void {
  evolutionState = null;
  lastPlan = null;
}
