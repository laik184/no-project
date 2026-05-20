import type { AnalysisViolation } from "../types.js";
import type { FixStrategy } from "./strategy.types.js";

export function buildIsolationStrategy(violation: Readonly<AnalysisViolation>): Readonly<FixStrategy> {
  if (violation.type.includes("STATE")) {
    return Object.freeze({
      strategy: "Route state changes through orchestrator and restrict state module exports.",
      reason: "State isolation prevents non-deterministic side effects.",
    });
  }

  if (violation.type.includes("LEAKAGE") || violation.type.includes("BOUNDARY")) {
    return Object.freeze({
      strategy: "Move violating file to correct boundary and expose explicit interface.",
      reason: "Boundary leakage is resolved by stricter isolation and controlled entry points.",
    });
  }

  return Object.freeze({
    strategy: "Isolate cross-layer interactions behind adapter or facade.",
    reason: "Isolation minimizes cascading impact while preserving behavior.",
  });
}
