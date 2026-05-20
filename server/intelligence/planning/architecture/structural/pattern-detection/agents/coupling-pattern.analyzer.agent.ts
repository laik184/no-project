import type { CouplingReport } from "../types.js";
import { clampScore, dependencyDensity } from "../utils/heuristic.engine.util.js";

export function analyzeCouplingPatterns(input: {
  readonly importGraph: Readonly<Record<string, readonly string[]>>;
}): CouplingReport {
  const tightCouplingPairs: string[] = [];
  const dependencyClusters: string[] = [];

  for (const [source, deps] of Object.entries(input.importGraph)) {
    if (deps.length >= 5) {
      dependencyClusters.push(`High fan-out cluster: ${source} (${deps.length} deps)`);
    }
    for (const dep of deps) {
      const reverse = input.importGraph[dep] ?? [];
      if (reverse.includes(source)) {
        tightCouplingPairs.push([source, dep].sort((a, b) => a.localeCompare(b)).join(" <-> "));
      }
    }
  }

  const density = dependencyDensity(input.importGraph);
  const couplingScore = clampScore((1 - density) * 100 - dependencyClusters.length * 3 - tightCouplingPairs.length * 2);

  return {
    tightCouplingPairs: Object.freeze([...new Set(tightCouplingPairs)].sort((a, b) => a.localeCompare(b))),
    dependencyClusters: Object.freeze([...new Set(dependencyClusters)].sort((a, b) => a.localeCompare(b))),
    couplingScore,
  };
}
