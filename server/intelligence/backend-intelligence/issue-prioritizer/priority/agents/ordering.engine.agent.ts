import type { ScoredIssue } from "../types.js";
import { roundScore } from "../utils/scoring.util.js";

const SEVERITY_WEIGHT = 0.4;
const IMPACT_WEIGHT = 0.4;
const URGENCY_WEIGHT = 0.2;

function computeFinalScore(issue: ScoredIssue): number {
  const weighted =
    (issue.severity * SEVERITY_WEIGHT)
    + (issue.impact * IMPACT_WEIGHT)
    + (issue.urgency * URGENCY_WEIGHT);

  return roundScore(weighted);
}

export function orderIssues(scoredIssues: readonly ScoredIssue[]): readonly ScoredIssue[] {
  const withFinalScore = scoredIssues.map((issue) => Object.freeze({
    ...issue,
    finalScore: computeFinalScore(issue),
  }));

  const sorted = [...withFinalScore].sort((left, right) => {
    if (right.finalScore !== left.finalScore) {
      return right.finalScore - left.finalScore;
    }

    if (right.severity !== left.severity) {
      return right.severity - left.severity;
    }

    return left.id.localeCompare(right.id);
  });

  return Object.freeze(sorted);
}
