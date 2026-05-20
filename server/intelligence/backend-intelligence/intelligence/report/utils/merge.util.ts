import type { IntelligenceModuleOutput, IssueLike } from "../types.js";

// ── Issue collection from module outputs ──────────────────────────────────────
//
// Knows which keys on an IntelligenceModuleOutput may carry issue-like arrays
// and merges them into a single flat list for the normalizer to process.

const CANDIDATE_KEYS = ["issues", "findings", "risks", "recommendations"] as const;

function toIssueArray(value: unknown): readonly IssueLike[] {
  if (!Array.isArray(value)) {
    return Object.freeze([]);
  }

  const issues = value.filter(
    (item) => typeof item === "object" && item !== null,
  ) as IssueLike[];

  return Object.freeze([...issues]);
}

export function collectIssues(output: IntelligenceModuleOutput | undefined): readonly IssueLike[] {
  if (!output) {
    return Object.freeze([]);
  }

  const merged: IssueLike[] = [];

  for (const key of CANDIDATE_KEYS) {
    merged.push(...toIssueArray(output[key]));
  }

  return Object.freeze(merged);
}
