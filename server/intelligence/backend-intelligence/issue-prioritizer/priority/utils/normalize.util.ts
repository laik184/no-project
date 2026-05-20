import type { Issue } from "../types.js";

const SCALE_MIN = 0;
const SCALE_MAX = 100;

export function clampToScale(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return SCALE_MIN;
  }

  if (value < SCALE_MIN) {
    return SCALE_MIN;
  }

  if (value > SCALE_MAX) {
    return SCALE_MAX;
  }

  return value;
}

export function normalizeRisk(value: number | undefined): number {
  return clampToScale(value ?? SCALE_MIN);
}

export function normalizeBooleanWeight(flag: boolean | undefined, weight: number): number {
  return flag ? clampToScale(weight) : SCALE_MIN;
}

// ── Issue lookup ──────────────────────────────────────────────────────────────
//
// Shared helper used by agents that need to look up full Issue data by ID
// during a scoring pass. Defined here (not in each agent) to eliminate
// duplication across the pipeline.

export function buildIssueMap(issues: readonly Issue[]): ReadonlyMap<string, Issue> {
  return new Map(issues.map((issue) => [issue.id, issue] as const));
}
