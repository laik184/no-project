import type { Issue, PriorityResult, PriorityState, ScoredIssue } from "./types.js";

export function createPriorityState(issues: readonly Issue[]): PriorityState {
  return Object.freeze({
    issues: Object.freeze([...issues]),
    scored: Object.freeze([]),
    sorted: Object.freeze([]),
  });
}

export function withScored(state: PriorityState, scored: readonly ScoredIssue[]): PriorityState {
  return Object.freeze({
    ...state,
    scored: Object.freeze([...scored]),
  });
}

export function withSorted(state: PriorityState, sorted: readonly ScoredIssue[]): PriorityState {
  return Object.freeze({
    ...state,
    sorted: Object.freeze([...sorted]),
  });
}

export function toPriorityResult(state: PriorityState): PriorityResult {
  return Object.freeze({
    sortedIssues: state.sorted,
  });
}
