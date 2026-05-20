import type {
  AnalysisFinding,
  RecommendationCandidate,
  RecommendationCategory,
  RecommendationImpact,
} from "../types.js";
import {
  ALL_RECOMMENDATION_CATEGORIES,
  ALL_RECOMMENDATION_IMPACTS,
} from "../types.js";

// ── Normalization ─────────────────────────────────────────────────────────────

function normalizeCategory(value: RecommendationCategory | undefined): RecommendationCategory {
  if (value === "security" || value === "performance" || value === "architecture") {
    return value;
  }

  return "architecture";
}

function normalizeImpact(
  impact:   RecommendationImpact | undefined,
  severity: RecommendationImpact | undefined,
): RecommendationImpact {
  const value = impact ?? severity;

  if (value === "CRITICAL" || value === "HIGH" || value === "MEDIUM" || value === "LOW") {
    return value;
  }

  return "MEDIUM";
}

// ── Sorting ───────────────────────────────────────────────────────────────────

function compareCandidates(a: RecommendationCandidate, b: RecommendationCandidate): number {
  if (a.priority !== b.priority) return b.priority - a.priority;

  const impactDiff =
    ALL_RECOMMENDATION_IMPACTS.indexOf(a.impact) -
    ALL_RECOMMENDATION_IMPACTS.indexOf(b.impact);
  if (impactDiff !== 0) return impactDiff;

  const categoryDiff =
    ALL_RECOMMENDATION_CATEGORIES.indexOf(a.category) -
    ALL_RECOMMENDATION_CATEGORIES.indexOf(b.category);
  if (categoryDiff !== 0) return categoryDiff;

  return a.subject.localeCompare(b.subject);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function groupFindings(
  findings: readonly AnalysisFinding[],
): readonly RecommendationCandidate[] {
  const candidates = findings.map((finding) => {
    const evidence = finding.evidence ?? [];

    return Object.freeze({
      subject:  finding.subject.trim(),
      message:  finding.message.trim(),
      category: normalizeCategory(finding.category),
      impact:   normalizeImpact(finding.impact, finding.severity),
      priority: 50,
      evidence: Object.freeze([...evidence]),
    });
  });

  return Object.freeze([...candidates].sort(compareCandidates));
}
