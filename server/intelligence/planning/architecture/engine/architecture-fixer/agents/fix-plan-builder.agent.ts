import type { FixAction, FixPlan, FixStep } from "../types.js";
import type { BuildPlanInput, OrderedPlanArtifacts } from "../types.js";

const RISK_BY_ACTION: Readonly<Record<FixAction["type"], number>> = Object.freeze({
  REWRITE_IMPORT: 5,
  MOVE_FILE: 12,
  SPLIT_FILE: 15,
  EXTRACT_INTERFACE: 8,
});

function buildDependencies(actions: readonly FixAction[]): readonly FixStep[] {
  const sorted = [...actions].sort((a, b) => a.priority - b.priority || a.actionId.localeCompare(b.actionId));
  const stepByViolation = new Map<string, string[]>();

  return Object.freeze(
    sorted.map((action) => {
      const previous = stepByViolation.get(action.violationId) ?? [];
      const step: FixStep = Object.freeze({
        stepId: `step-${action.actionId}`,
        action,
        dependsOn: Object.freeze([...previous]),
      });
      stepByViolation.set(action.violationId, [...previous, step.stepId]);
      return step;
    }),
  );
}

function computeRisk(actions: readonly FixAction[]): number {
  return actions.reduce((total, action) => total + RISK_BY_ACTION[action.type], 0);
}

export function buildFixPlan(input: BuildPlanInput): OrderedPlanArtifacts {
  const warnings: string[] = [];

  const dedupedActions = Array.from(
    new Map(input.actions.map((action) => [action.actionId, action])).values(),
  );

  if (dedupedActions.length !== input.actions.length) {
    warnings.push("Conflicting fix actions detected; deterministic de-duplication applied.");
  }

  const steps = buildDependencies(dedupedActions);
  const riskScore = computeRisk(dedupedActions);
  const reversible = dedupedActions.every((action) => action.type !== "SPLIT_FILE" || !!action.params.source);

  const plan: FixPlan = Object.freeze({
    steps,
    riskScore,
    reversible,
    warnings: Object.freeze(warnings),
  });

  return Object.freeze({
    steps,
    warnings: Object.freeze(warnings),
    riskScore,
    reversible,
    plan,
  });
}
