import type { ArchitectureAnalysisReport, ArchitecturePattern } from "../types.js";
import { buildPatternUpgradePath } from "./pattern-map.util.js";

export function selectTargetPattern(
  current: ArchitecturePattern,
  report: Readonly<ArchitectureAnalysisReport>,
): ArchitecturePattern {
  const teamSize = report.metadata?.teamSize ?? 5;
  const scale = report.metadata?.scale ?? "medium";
  const throughputRps = report.metadata?.throughputRps ?? 150;
  const path = buildPatternUpgradePath(current);

  if (current === "microservices") {
    return "microservices";
  }

  if (teamSize >= 12 && (scale === "high" || throughputRps >= 1000)) {
    return path[path.length - 1] ?? "microservices";
  }

  return path[0] ?? "modular";
}

export function buildStrategyNarrative(current: ArchitecturePattern, target: ArchitecturePattern): string {
  if (current === target) {
    return "Optimize service boundaries and operational maturity without changing macro-pattern.";
  }

  if (current === "monolith" && target === "modular") {
    return "Stabilize the monolith by introducing bounded modules before distributed decomposition.";
  }

  if (current === "modular" && target === "microservices") {
    return "Promote high-churn modules into services with explicit contracts and independent deployability.";
  }

  return `Evolve from ${current} to ${target} through incremental boundary hardening and contract-first integration.`;
}
