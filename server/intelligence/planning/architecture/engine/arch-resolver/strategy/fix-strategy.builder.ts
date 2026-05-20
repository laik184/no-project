import type { DecisionBuildContext } from "../types.js";
import type { FixStrategy } from "./strategy.types.js";
import { buildRefactorStrategy } from "./refactor.strategy.js";
import { buildIsolationStrategy } from "./isolation.strategy.js";

export function buildFixStrategy(context: Readonly<DecisionBuildContext>): Readonly<FixStrategy> {
  const { classified, urgent } = context;

  if (classified.category === "boundary" || classified.category === "hvp") {
    return buildIsolationStrategy(classified.violation);
  }

  const refactor = buildRefactorStrategy(classified.violation);

  if (!urgent) return refactor;

  return Object.freeze({
    strategy: `${refactor.strategy} Execute in guarded rollout with incremental verification.`,
    reason: `${refactor.reason} Urgency requires rollout-safe execution.`,
  });
}
