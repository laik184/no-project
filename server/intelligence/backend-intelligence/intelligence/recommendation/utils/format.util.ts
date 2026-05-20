import type {
  FixRecommendation,
  GeneratedAction,
  ImprovementSuggestion,
  Recommendation,
  RecommendationCandidate,
} from "../types.js";

function buildId(subject: string, title: string): string {
  const normalized = `${subject}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `rec-${normalized}`;
}

function fallback<T>(map: ReadonlyMap<string, T>, subject: string, defaultValue: T): T {
  return map.get(subject) ?? defaultValue;
}

export function formatRecommendations(
  candidates: readonly RecommendationCandidate[],
  suggestions: readonly ImprovementSuggestion[],
  fixes: readonly FixRecommendation[],
  actions: readonly GeneratedAction[],
  explanations: ReadonlyMap<string, string>,
): readonly Recommendation[] {
  const suggestionBySubject = new Map(suggestions.map((item) => [item.subject, item] as const));
  const fixesBySubject = new Map(fixes.map((item) => [item.subject, item] as const));
  const actionBySubject = new Map(actions.map((item) => [item.subject, item] as const));

  const recommendations = candidates.map((candidate) => {
    const suggestion = fallback(suggestionBySubject, candidate.subject, {
      subject: candidate.subject,
      title: `Improve ${candidate.subject}`,
      description: candidate.message,
      category: candidate.category,
    });

    const fix = fallback(fixesBySubject, candidate.subject, {
      subject: candidate.subject,
      steps: Object.freeze([`Investigate ${candidate.subject} and apply targeted remediation.`]),
    });

    const action = fallback(actionBySubject, candidate.subject, {
      subject: candidate.subject,
      action: `Stabilize ${candidate.subject} with explicit module boundaries and measurable acceptance criteria.`,
    });

    const explanation =
      explanations.get(candidate.subject) ??
      `Addressing ${candidate.subject} reduces delivery risk and improves backend reliability.`;

    return Object.freeze({
      id: buildId(candidate.subject, suggestion.title),
      title: suggestion.title,
      description: suggestion.description,
      action: action.action,
      impact: candidate.impact,
      category: suggestion.category,
      priority: candidate.priority,
      steps: Object.freeze([...fix.steps]),
      explanation,
    });
  });

  return Object.freeze(recommendations);
}
