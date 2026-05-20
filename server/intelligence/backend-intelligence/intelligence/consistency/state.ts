import type {
  Conflict,
  ConsistencyOutput,
  FinalTruth,
  ValidationResult,
} from "./types.js";

export interface ConsistencyState {
  readonly conflicts: readonly Conflict[];
  readonly validationResults: readonly ValidationResult[];
  readonly finalTruth: readonly FinalTruth[];
}

export function createEmptyState(): ConsistencyState {
  return Object.freeze({
    conflicts: Object.freeze([]),
    validationResults: Object.freeze([]),
    finalTruth: Object.freeze([]),
  });
}

export function withConflicts(
  state: ConsistencyState,
  conflicts: readonly Conflict[],
): ConsistencyState {
  return Object.freeze({
    ...state,
    conflicts: Object.freeze([...conflicts]),
  });
}

export function withValidationResults(
  state: ConsistencyState,
  validationResults: readonly ValidationResult[],
): ConsistencyState {
  return Object.freeze({
    ...state,
    validationResults: Object.freeze([...validationResults]),
  });
}

export function withFinalTruth(
  state: ConsistencyState,
  finalTruth: readonly FinalTruth[],
): ConsistencyState {
  return Object.freeze({
    ...state,
    finalTruth: Object.freeze([...finalTruth]),
  });
}

export function toOutput(state: ConsistencyState): ConsistencyOutput {
  return Object.freeze({
    isConsistent: state.conflicts.length === 0,
    conflicts: Object.freeze([...state.conflicts]),
    resolved: state.finalTruth.length > 0,
    finalTruth: Object.freeze([...state.finalTruth]),
  });
}
