import type { ArchitectureClassification } from "../types.js";
import { dependencyDensity, moduleIndependenceRatio } from "../utils/heuristic.engine.util.js";

export function classifyArchitecturePattern(input: {
  readonly files: readonly string[];
  readonly importGraph: Readonly<Record<string, readonly string[]>>;
  readonly modules: readonly string[];
}): ArchitectureClassification {
  const layerKeywords = ["controller", "service", "repo", "repository"];
  const layerHits = input.files.filter((f) => layerKeywords.some((k) => f.toLowerCase().includes(k))).length;
  const density = dependencyDensity(input.importGraph);
  const independence = moduleIndependenceRatio(input.files, input.importGraph);
  const serviceFolders = input.modules.filter((m) => m.toLowerCase().includes("service")).length;

  if (serviceFolders >= 2 && independence >= 0.7) {
    return { type: "microservice", confidence: 0.88 };
  }
  if (layerHits >= 3 && density <= 0.28) {
    return { type: "layered", confidence: 0.82 };
  }
  if (input.modules.length >= 4 && independence >= 0.5) {
    return { type: "modular", confidence: 0.76 };
  }
  return { type: "monolith", confidence: density >= 0.25 ? 0.8 : 0.62 };
}
