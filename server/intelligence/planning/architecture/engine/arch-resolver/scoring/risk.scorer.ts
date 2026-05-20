import type { AnalysisViolation } from "../types.js";
import { clampScore } from "../utils/normalization.util.js";

function productionBreakRisk(violation: Readonly<AnalysisViolation>): number {
  const signal = `${violation.type} ${violation.message}`.toLowerCase();
  if (signal.includes("state_mutation") || signal.includes("circular") || signal.includes("bypass")) return 95;
  if (signal.includes("boundary") || signal.includes("import_direction") || signal.includes("layer")) return 80;
  return 60;
}

function performanceRisk(violation: Readonly<AnalysisViolation>): number {
  const signal = `${violation.type} ${violation.message}`.toLowerCase();
  if (signal.includes("circular") || signal.includes("mixed_concerns")) return 75;
  if (signal.includes("dependency") || signal.includes("large")) return 65;
  return 45;
}

function securityRisk(violation: Readonly<AnalysisViolation>): number {
  const signal = `${violation.type} ${violation.message} ${(violation.evidence ?? []).join(" ")}`.toLowerCase();
  if (signal.includes("auth") || signal.includes("security") || signal.includes("leak")) return 90;
  if (signal.includes("state") || signal.includes("cross_domain")) return 70;
  return 40;
}

export function scoreRisk(violation: Readonly<AnalysisViolation>): number {
  const prod = productionBreakRisk(violation);
  const perf = performanceRisk(violation);
  const sec = securityRisk(violation);
  return clampScore((prod * 0.45) + (perf * 0.25) + (sec * 0.3));
}
