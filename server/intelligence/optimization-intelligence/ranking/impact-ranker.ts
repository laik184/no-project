import type { OptimizationFinding, RankedSuggestion, OptimizationSummary, ImpactLevel, OptimizationCategory } from "../types.js";

const IMPACT_ORDER: Record<ImpactLevel, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

const EFFORT_MAP: Record<ImpactLevel, "LOW" | "MEDIUM" | "HIGH"> = {
  CRITICAL: "HIGH",
  HIGH: "MEDIUM",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
};

export function rankSuggestions(findings: readonly OptimizationFinding[]): readonly RankedSuggestion[] {
  const sorted = [...findings].sort((a, b) => IMPACT_ORDER[b.impact] - IMPACT_ORDER[a.impact]);
  return Object.freeze(
    sorted.map((f, i) =>
      Object.freeze<RankedSuggestion>({
        rank: i + 1,
        findingId: f.findingId,
        category: f.category,
        suggestion: f.description,
        impact: f.impact,
        score: f.score,
        effort: EFFORT_MAP[f.impact],
      }),
    ),
  );
}

export function buildSummary(findings: readonly OptimizationFinding[]): OptimizationSummary {
  const criticalCount = findings.filter(f => f.impact === 'CRITICAL').length;
  const highCount = findings.filter(f => f.impact === 'HIGH').length;
  const mediumCount = findings.filter(f => f.impact === 'MEDIUM').length;
  const lowCount = findings.filter(f => f.impact === 'LOW').length;

  const overallScore = findings.length === 0 ? 100 : Math.max(0, 100 - (criticalCount * 25 + highCount * 15 + mediumCount * 8 + lowCount * 3));

  const categoryCounts = new Map<OptimizationCategory, number>();
  for (const f of findings) {
    categoryCounts.set(f.category, (categoryCounts.get(f.category) ?? 0) + 1);
  }
  let topCategory: OptimizationCategory | null = null;
  let maxCount = 0;
  for (const [cat, count] of categoryCounts) {
    if (count > maxCount) { maxCount = count; topCategory = cat; }
  }

  const priorityFocus = criticalCount > 0 ? 'Fix critical issues immediately'
    : highCount > 0 ? 'Address high-impact issues'
    : mediumCount > 0 ? 'Resolve medium-priority findings'
    : findings.length === 0 ? 'No issues found'
    : 'Monitor low-priority findings';

  return Object.freeze({
    totalFindings: findings.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    topCategory,
    overallScore,
    priorityFocus,
  });
}
