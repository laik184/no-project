import type { MicroserviceReport } from "../types.js";
import { groupFilesByModule } from "../utils/folder-structure.util.js";

export function detectMicroserviceBoundaries(input: {
  readonly files: readonly string[];
  readonly importGraph: Readonly<Record<string, readonly string[]>>;
}): MicroserviceReport {
  const grouped = groupFilesByModule(input.files);
  const moduleNames = Object.keys(grouped);
  const serviceModules = moduleNames.filter((m) => m.toLowerCase().includes("service"));

  const boundaryViolations: string[] = [];
  let independentServices = 0;

  for (const moduleName of serviceModules) {
    const files = new Set(grouped[moduleName]);
    let crossDependency = false;

    for (const file of files) {
      for (const dep of input.importGraph[file] ?? []) {
        if (dep.startsWith(".") && !files.has(dep)) {
          crossDependency = true;
          boundaryViolations.push(`Service boundary leak: ${file} -> ${dep}`);
        }
      }
    }

    if (!crossDependency) independentServices += 1;
  }

  const confidence = serviceModules.length === 0
    ? 0
    : Math.max(0, Math.min(1, independentServices / serviceModules.length));

  return {
    serviceCount: serviceModules.length,
    independentServices,
    boundaryViolations: Object.freeze(boundaryViolations.sort((a, b) => a.localeCompare(b))),
    confidence,
  };
}
