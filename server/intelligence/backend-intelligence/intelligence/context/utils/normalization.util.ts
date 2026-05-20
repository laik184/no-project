import type { BackendSignalInput, NormalizedSignals } from "../types.js";

function normalizeList(values: readonly string[]): readonly string[] {
  const normalized = values
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);

  const unique = Array.from(new Set(normalized));
  unique.sort();
  return Object.freeze(unique);
}

function normalizeCount(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.floor(value);
}

export function normalizeSignals(input: BackendSignalInput): NormalizedSignals {
  if (input === null || input === undefined || typeof input !== "object") {
    return Object.freeze({
      filePaths:     Object.freeze([]),
      dependencies:  Object.freeze([]),
      configKeys:    Object.freeze([]),
      serviceCount:  0,
      moduleCount:   0,
      endpointCount: 0,
    });
  }
  return Object.freeze({
    filePaths:     normalizeList(Array.isArray(input.filePaths)    ? input.filePaths    : []),
    dependencies:  normalizeList(Array.isArray(input.dependencies) ? input.dependencies : []),
    configKeys:    normalizeList(Array.isArray(input.configKeys)   ? input.configKeys   : []),
    serviceCount:  normalizeCount(typeof input.serviceCount  === "number" ? input.serviceCount  : 0),
    moduleCount:   normalizeCount(typeof input.moduleCount   === "number" ? input.moduleCount   : 0),
    endpointCount: normalizeCount(typeof input.endpointCount === "number" ? input.endpointCount : 0),
  });
}
