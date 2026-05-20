import type { Issue, ScoredIssue } from "../types.js";
import { buildIssueMap, normalizeRisk } from "../utils/normalize.util.js";
import { average } from "../utils/scoring.util.js";

export function analyzeImpact(
  issues: readonly Issue[],
  severityScored: readonly ScoredIssue[],
): readonly ScoredIssue[] {
  const issueById = buildIssueMap(issues);

  const scored = severityScored.map((item) => {
    const issue = issueById.get(item.id);

    const impact = average([
      normalizeRisk(issue?.affectedUsers),
      normalizeRisk(issue?.performanceDegradation),
      normalizeRisk(issue?.scalabilityRisk),
    ]);

    return Object.freeze({
      ...item,
      impact,
    });
  });

  return Object.freeze(scored);
}
