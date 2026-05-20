import { groupFilesByModule } from "../utils/folder-structure.util.js";
import { detectCircularDependencies, dependencyDensity } from "../utils/heuristic.engine.util.js";

export function detectAntiPatterns(input: {
  readonly files: readonly string[];
  readonly importGraph: Readonly<Record<string, readonly string[]>>;
  readonly layerViolations: readonly string[];
}): readonly string[] {
  const findings: string[] = [];
  const grouped = groupFilesByModule(input.files);

  for (const [moduleName, moduleFiles] of Object.entries(grouped)) {
    if (moduleFiles.length >= 12) {
      findings.push(`God module detected: ${moduleName}`);
    }
  }

  const circular = detectCircularDependencies(input.importGraph);
  for (const pair of circular) {
    findings.push(`Circular dependency cluster: ${pair}`);
  }

  if (dependencyDensity(input.importGraph) > 0.3) {
    findings.push("Spaghetti code: dependency density exceeds safe threshold");
  }

  for (const [file, deps] of Object.entries(input.importGraph)) {
    if (file.toLowerCase().includes("state") && deps.length > 4) {
      findings.push(`Shared mutable state risk: ${file}`);
    }
  }

  for (const violation of input.layerViolations) {
    findings.push(`Layer violation: ${violation}`);
  }

  return Object.freeze([...new Set(findings)].sort((a, b) => a.localeCompare(b)));
}
