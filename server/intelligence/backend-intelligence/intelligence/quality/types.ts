export type QualityGrade = "A" | "B" | "C" | "D" | "F";

// ── Canonical dimension enumeration (single source of truth) ──────────────────
// All per-dimension logic (scoring, weighting, aggregation) loops over this
// array. Adding a new dimension only requires a change here + its business rules.

export const QUALITY_DIMENSIONS = [
  "architecture",
  "security",
  "performance",
  "codeQuality",
  "risk",
] as const;

export type QualityDimension = (typeof QUALITY_DIMENSIONS)[number];

// ── Domain types ──────────────────────────────────────────────────────────────

export interface QualityInput {
  readonly architecture: number;
  readonly security:     number;
  readonly performance:  number;
  readonly codeQuality:  number;
  readonly risk:         number;
}

// QualityBreakdown and QualityWeights share the same shape: one numeric value
// per quality dimension. Distinct named types keep call-sites readable.
export type QualityBreakdown = Readonly<Record<QualityDimension, number>>;
export type QualityWeights   = Readonly<Record<QualityDimension, number>>;

export interface WeightedDimension {
  readonly dimension:     QualityDimension;
  readonly score:         number;
  readonly weight:        number;
  readonly weightedScore: number;
}

export interface QualityReport {
  readonly score: number;
  readonly grade: QualityGrade;
  readonly breakdown: QualityBreakdown;
}
