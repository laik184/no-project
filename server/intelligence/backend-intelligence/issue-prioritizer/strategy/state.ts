import type { FinalStrategyOutput, StrategyPlan } from "./types.js";

// ── Output assembly ───────────────────────────────────────────────────────────
//
// Assembles the final output from a resolved list of strategy plans.
// All other state-tracking helpers (createStrategyState, withStrategyMetrics)
// were removed — they accumulated metrics but the result was never used.

export function toFinalOutput(plans: readonly StrategyPlan[]): FinalStrategyOutput {
  const frozenPlans = Object.freeze([...plans]);
  const totalSteps = frozenPlans.reduce((sum, plan) => sum + plan.steps.length, 0);

  return Object.freeze({
    plans: frozenPlans,
    totalSteps,
  });
}
