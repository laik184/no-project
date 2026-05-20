import type { AnalysisViolation } from "../types.js";
import { clampScore } from "../utils/normalization.util.js";

function moduleSpreadScore(violation: Readonly<AnalysisViolation>): number {
  const modules = new Set<string>();
  if (violation.file) modules.add(violation.file);
  if (violation.source) modules.add(violation.source);
  if (violation.from) modules.add(violation.from);
  if (violation.to) modules.add(violation.to);
  if (violation.importedFile) modules.add(violation.importedFile);
  const count = modules.size;
  if (count >= 4) return 100;
  if (count === 3) return 80;
  if (count === 2) return 60;
  return 40;
}

function layerDepthScore(violation: Readonly<AnalysisViolation>): number {
  if (typeof violation.layer === "number") {
    return clampScore(violation.layer * 25);
  }

  if (typeof violation.fromLayer === "number" && typeof violation.toLayer === "number") {
    const depth = Math.abs(violation.fromLayer - violation.toLayer) + 1;
    return clampScore(depth * 20);
  }

  return 45;
}

function criticalityScore(violation: Readonly<AnalysisViolation>): number {
  const signal = `${violation.type} ${violation.message} ${violation.rule ?? ""}`.toLowerCase();
  if (signal.includes("state") || signal.includes("security") || signal.includes("orchestrator")) return 95;
  if (signal.includes("dependency") || signal.includes("boundary") || signal.includes("layer")) return 80;
  if (signal.includes("util") || signal.includes("concern")) return 65;
  return 50;
}

export function scoreImpact(violation: Readonly<AnalysisViolation>): number {
  const modules = moduleSpreadScore(violation);
  const depth = layerDepthScore(violation);
  const criticality = criticalityScore(violation);
  return clampScore((modules * 0.4) + (depth * 0.3) + (criticality * 0.3));
}
