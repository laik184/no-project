import type { EvolutionStrategy, MigrationPlan, PatternDetectionResult } from "../types.js";

export function generateMigrationPlan(
  detected: Readonly<PatternDetectionResult>,
  strategy: Readonly<EvolutionStrategy>,
): MigrationPlan {
  const steps: string[] = [];

  steps.push("Step 1: inventory domains and isolate module boundaries by business capability.");

  if (detected.antiPatterns.includes("cyclic dependencies")) {
    steps.push("Step 2: break cyclic dependencies with interface extraction and event-driven handoffs.");
  } else {
    steps.push("Step 2: enforce one-way dependency rules across layers and modules.");
  }

  if (detected.antiPatterns.includes("god module")) {
    steps.push("Step 3: split god modules into cohesive bounded-context components.");
  } else {
    steps.push("Step 3: refactor large modules into focused domain packages.");
  }

  if (strategy.targetPattern === "microservices") {
    steps.push("Step 4: extract high-churn domains into independently deployable services.");
    steps.push("Step 5: introduce API gateway and contract testing for service communication.");
    steps.push("Step 6: migrate data ownership to per-service stores with synchronization safeguards.");
  } else {
    steps.push("Step 4: introduce stable internal API layer between modules.");
    steps.push("Step 5: standardize module contracts, observability, and release boundaries.");
  }

  return Object.freeze({ migrationSteps: Object.freeze(steps) });
}
