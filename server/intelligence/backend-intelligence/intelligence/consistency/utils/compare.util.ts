import type { ConsistencySignal, ConsistencyStatus, Severity } from "../types.js";

const SEVERITY_WEIGHT: Readonly<Record<Severity, number>> = Object.freeze({
  LOW: 0.25,
  MEDIUM: 0.5,
  HIGH: 0.75,
  CRITICAL: 1,
});

export function severityRank(severity: Severity): number {
  switch (severity) {
    case "LOW":
      return 1;
    case "MEDIUM":
      return 2;
    case "HIGH":
      return 3;
    case "CRITICAL":
      return 4;
  }
}

export function maxSeverity(signals: readonly ConsistencySignal[]): Severity {
  return [...signals].sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity),
  )[0]?.severity ?? "LOW";
}

export function normalizeStatus(value: string): ConsistencyStatus {
  const normalized = value.trim().toUpperCase();
  if (normalized === "OK") {
    return "OK";
  }
  if (normalized === "NOT_OK") {
    return "NOT_OK";
  }
  return "UNKNOWN";
}

export function normalizeScore(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

export function scoreDifference(a: number, b: number): number {
  return Math.abs(normalizeScore(a) - normalizeScore(b));
}

export function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (typeof left !== typeof right || left === null || right === null) {
    return false;
  }

  if (typeof left !== "object") {
    return false;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false;
    }

    return left.every((item, index) => deepEqual(item, right[index]));
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    return false;
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;

  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();

  if (!deepEqual(leftKeys, rightKeys)) {
    return false;
  }

  return leftKeys.every((key) => deepEqual(leftRecord[key], rightRecord[key]));
}

export function severityWeight(severity: Severity): number {
  return SEVERITY_WEIGHT[severity];
}
