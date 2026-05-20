import type { RecommendationCandidate, RecommendationContext } from "../types.js";

function buildContextSuffix(context: RecommendationContext | undefined): string {
  if (!context) {
    return "";
  }

  const segments: string[] = [];

  if (context.domain) {
    segments.push(`domain: ${context.domain}`);
  }

  if (context.environment) {
    segments.push(`environment: ${context.environment}`);
  }

  if (context.constraints && context.constraints.length > 0) {
    segments.push(`constraints: ${context.constraints.join(", ")}`);
  }

  return segments.length > 0 ? ` Context considered (${segments.join("; ")}).` : "";
}

function impactExplanation(candidate: RecommendationCandidate): string {
  if (candidate.impact === "CRITICAL" || candidate.impact === "HIGH") {
    return "This change directly lowers severe failure risk and protects service reliability.";
  }

  if (candidate.impact === "MEDIUM") {
    return "This change improves operational stability and reduces recurring incidents.";
  }

  return "This change improves maintainability and prevents low-severity regressions from accumulating.";
}

export function buildExplanations(
  candidates: readonly RecommendationCandidate[],
  context?: RecommendationContext,
): ReadonlyMap<string, string> {
  const suffix = buildContextSuffix(context);
  const entries = candidates.map((candidate) => {
    const explanation = `${impactExplanation(candidate)} It targets ${candidate.subject} and aligns remediation effort with priority ${candidate.priority}.${suffix}`;

    return [candidate.subject, explanation] as const;
  });

  return new Map(entries);
}
