import type { Decision, DecisionPlan, DecisionState } from "./types.js";

const state: { value: DecisionState } = {
  value: Object.freeze({
    decisions: Object.freeze([]),
    lastRunAt: 0,
  }),
};

export function getDecisionState(): Readonly<DecisionState> {
  return state.value;
}

export function setDecisionState(decisions: readonly Decision[], at: number): Readonly<DecisionState> {
  state.value = Object.freeze({
    decisions: Object.freeze([...decisions]),
    lastRunAt: at,
  });
  return state.value;
}

export function toDecisionPlan(decisions: readonly Decision[]): Readonly<DecisionPlan> {
  const highPriority = decisions.filter((decision) => decision.priority === "HIGH").length;
  const mediumPriority = decisions.filter((decision) => decision.priority === "MEDIUM").length;
  const lowPriority = decisions.filter((decision) => decision.priority === "LOW").length;

  return Object.freeze({
    totalIssues: decisions.length,
    highPriority,
    mediumPriority,
    lowPriority,
    decisions: Object.freeze([...decisions]),
  });
}
