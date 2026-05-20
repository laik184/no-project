import type { NormalizedSignals, ProjectSize, ProjectType } from "../types.js";

// ── Thresholds ─────────────────────────────────────────────────────────────────

const MICROSERVICE_SERVICE_MIN = 4;
const MICROSERVICE_PATH_MARKER = "services/";
const MODULAR_MODULE_MIN       = 6;
const MODULAR_PATH_MARKER      = "modules/";

const SIZE_LARGE_THRESHOLD  = 120;
const SIZE_MEDIUM_THRESHOLD = 45;

const SIZE_ENDPOINT_WEIGHT = 2;
const SIZE_MODULE_WEIGHT   = 3;
const SIZE_SERVICE_WEIGHT  = 4;

// ── Classifiers ────────────────────────────────────────────────────────────────

export function pickProjectType(signals: NormalizedSignals): ProjectType {
  if (
    signals.serviceCount >= MICROSERVICE_SERVICE_MIN ||
    signals.filePaths.some((p) => p.includes(MICROSERVICE_PATH_MARKER))
  ) {
    return "microservice";
  }

  if (
    signals.moduleCount >= MODULAR_MODULE_MIN ||
    signals.filePaths.some((p) => p.includes(MODULAR_PATH_MARKER))
  ) {
    return "modular";
  }

  return "monolith";
}

export function pickProjectSize(signals: NormalizedSignals): ProjectSize {
  const score =
    signals.filePaths.length +
    signals.endpointCount * SIZE_ENDPOINT_WEIGHT +
    signals.moduleCount   * SIZE_MODULE_WEIGHT   +
    signals.serviceCount  * SIZE_SERVICE_WEIGHT;

  if (score >= SIZE_LARGE_THRESHOLD)  return "large";
  if (score >= SIZE_MEDIUM_THRESHOLD) return "medium";
  return "small";
}
