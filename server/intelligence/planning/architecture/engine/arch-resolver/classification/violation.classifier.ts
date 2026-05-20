import type { AnalysisViolation, ViolationCategory } from "../types.js";

const DEPENDENCY_KEYS = Object.freeze(["dependency", "import", "circular", "cycle"]);
const BOUNDARY_KEYS = Object.freeze(["boundary", "domain", "leakage", "layer"]);
const RESPONSIBILITY_KEYS = Object.freeze(["srp", "responsibility", "concern", "logic", "oversized"]);
const HVP_KEYS = Object.freeze(["hvp", "orchestrator", "validator", "state_mutation"]);

function includesAny(signal: string, keys: readonly string[]): boolean {
  return keys.some((key) => signal.includes(key));
}

export function classifyViolation(violation: Readonly<AnalysisViolation>): ViolationCategory {
  const signal = `${violation.type} ${violation.message} ${violation.rule ?? ""}`.toLowerCase();

  if (includesAny(signal, RESPONSIBILITY_KEYS)) return "responsibility";
  if (includesAny(signal, HVP_KEYS)) return "hvp";
  if (includesAny(signal, BOUNDARY_KEYS)) return "boundary";
  if (includesAny(signal, DEPENDENCY_KEYS)) return "dependency";

  return "dependency";
}
