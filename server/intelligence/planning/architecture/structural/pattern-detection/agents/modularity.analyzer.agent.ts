import type { ModularityReport } from "../types.js";
import { groupFilesByModule } from "../utils/folder-structure.util.js";
import { clampScore, moduleIndependenceRatio } from "../utils/heuristic.engine.util.js";

export function analyzeModularity(input: {
  readonly files: readonly string[];
  readonly importGraph: Readonly<Record<string, readonly string[]>>;
}): ModularityReport {
  const grouped = groupFilesByModule(input.files);
  const modules = Object.keys(grouped);
  const independence = moduleIndependenceRatio(input.files, input.importGraph);

  const cohesionRatios = modules.map((moduleName) => {
    const moduleFiles = new Set(grouped[moduleName]);
    let internalEdges = 0;
    let totalEdges = 0;

    for (const file of moduleFiles) {
      for (const dep of input.importGraph[file] ?? []) {
        totalEdges += 1;
        if (moduleFiles.has(dep)) internalEdges += 1;
      }
    }

    return totalEdges === 0 ? 1 : internalEdges / totalEdges;
  });

  const cohesionScore = clampScore(
    cohesionRatios.length === 0
      ? 0
      : (cohesionRatios.reduce((sum, value) => sum + value, 0) / cohesionRatios.length) * 100,
  );
  const couplingScore = clampScore((1 - independence) * 100);
  const modularityScore = clampScore(cohesionScore * 0.6 + (100 - couplingScore) * 0.4);

  return {
    moduleCount: modules.length,
    independentModules: Math.round(modules.length * independence),
    cohesionScore,
    couplingScore,
    modularityScore,
  };
}
