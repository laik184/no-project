import type { FixableViolation, Severity, ViolationKind } from "../types.js";
import type { RawViolation, ViolationMappingResult } from "../types.js";

let violationCounter = 0;

function nextViolationId(): string {
  violationCounter += 1;
  return `fxv-${String(violationCounter).padStart(4, "0")}`;
}

function normalizeKind(rawType?: string): ViolationKind {
  const value = (rawType ?? "").toUpperCase();
  if (value.includes("LAYER") || value.includes("BOUNDARY") || value.includes("CROSS_LAYER")) {
    return "LAYER_VIOLATION";
  }
  if (value.includes("CYCLE")) return "DEPENDENCY_CYCLE";
  if (value.includes("DOMAIN") && value.includes("LEAK")) return "DOMAIN_LEAKAGE";
  if (value.includes("SRP") || value.includes("RESPONSIBILITY")) return "SRP_VIOLATION";
  return "UNSUPPORTED";
}

function normalizeSeverity(rawSeverity?: string): Severity {
  const value = (rawSeverity ?? "MEDIUM").toUpperCase();
  if (value === "CRITICAL" || value === "HIGH" || value === "MEDIUM" || value === "LOW") {
    return value;
  }
  return "MEDIUM";
}

function toMetadata(details?: Readonly<Record<string, unknown>>): Readonly<Record<string, string | number | boolean>> {
  if (!details) return Object.freeze({});
  const metadata: Record<string, string | number | boolean> = {};
  const keys = Object.keys(details).sort();
  for (const key of keys) {
    const value = details[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      metadata[key] = value;
    }
  }
  return Object.freeze(metadata);
}

export function mapViolations(raw: readonly RawViolation[]): ViolationMappingResult {
  if (!Array.isArray(raw) || raw.length === 0) {
    return Object.freeze({ violations: Object.freeze([]), warnings: Object.freeze([]) });
  }

  const warnings: string[] = [];
  const normalized = [...raw]
    .map((entry, index) => Object.freeze({ entry, index }))
    .sort((a, b) => {
      const aId = (a.entry.id ?? "").toString();
      const bId = (b.entry.id ?? "").toString();
      return aId.localeCompare(bId) || a.index - b.index;
    })
    .map(({ entry }) => {
      const kind = normalizeKind(entry.type);
      const id = entry.id ?? nextViolationId();
      const source = entry.file ?? entry.source ?? "unknown";
      if (kind === "UNSUPPORTED") {
        warnings.push(`Unsupported violation skipped: ${entry.type ?? "UNKNOWN"} (${id})`);
      }

      const violation: FixableViolation = Object.freeze({
        id,
        kind,
        severity: normalizeSeverity(entry.severity),
        source,
        target: entry.importedFile ?? entry.target,
        evidence: Object.freeze((entry.evidence ?? []).map((item) => Object.freeze({ file: source, detail: item }))),
        metadata: toMetadata(entry.details),
      });
      return violation;
    })
    .filter((violation) => violation.kind !== "UNSUPPORTED");

  return Object.freeze({
    violations: Object.freeze(normalized),
    warnings: Object.freeze(warnings),
  });
}

export function resetViolationMapperState(): void {
  violationCounter = 0;
}
