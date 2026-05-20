import type { AnalysisViolation } from "../types.js";
import type { FixStrategy } from "./strategy.types.js";

export function buildRefactorStrategy(violation: Readonly<AnalysisViolation>): Readonly<FixStrategy> {
  if (violation.type.includes("CIRCULAR") || violation.type.includes("DEPENDENCY")) {
    return Object.freeze({
      strategy: "Extract interface/port, invert dependency, and update import direction.",
      reason: "Dependency issues are stabilized by introducing abstraction boundaries.",
    });
  }

  if (violation.type.includes("MIXED_CONCERNS") || violation.type.includes("MULTIPLE_RESPONSIBILITIES")) {
    return Object.freeze({
      strategy: "Split module into focused units and relocate business logic to domain layer.",
      reason: "SRP violations require decomposition and clear ownership boundaries.",
    });
  }

  return Object.freeze({
    strategy: "Refactor violated module and rewire imports to restore architectural intent.",
    reason: "Refactoring is required when direct fixes do not isolate the root cause.",
  });
}
