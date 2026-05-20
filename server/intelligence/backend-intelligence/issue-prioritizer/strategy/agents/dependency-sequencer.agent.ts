import { mergeAndOrderPlans, orderByDependencies } from "../utils/plan.util.js";
import type { StrategyPlan } from "../types.js";

export function sequenceDependencies(plans: readonly StrategyPlan[]): readonly StrategyPlan[] {
  const sequenced = plans.map((plan) =>
    Object.freeze({
      ...plan,
      steps: orderByDependencies(plan.steps),
    }),
  );

  return mergeAndOrderPlans(sequenced);
}
