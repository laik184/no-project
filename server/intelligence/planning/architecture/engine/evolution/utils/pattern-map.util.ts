import type { ArchitecturePattern, PatternMetrics } from "../types.js";

export function inferPatternFromMetrics(metrics: PatternMetrics): ArchitecturePattern {
  if (metrics.serviceCount >= 5) {
    return "microservices";
  }

  if (metrics.moduleCount >= 8 && metrics.couplingSignals <= 2) {
    return "modular";
  }

  if (metrics.moduleCount >= 4) {
    return "layered";
  }

  return "monolith";
}

export function buildPatternUpgradePath(current: ArchitecturePattern): readonly ArchitecturePattern[] {
  switch (current) {
    case "monolith":
      return ["modular", "microservices"];
    case "layered":
      return ["modular", "microservices"];
    case "modular":
      return ["microservices"];
    case "microservices":
      return ["microservices"];
    default:
      return ["modular"];
  }
}
