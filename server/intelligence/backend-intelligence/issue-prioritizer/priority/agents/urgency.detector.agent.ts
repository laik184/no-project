import type { Issue, ScoredIssue } from "../types.js";
import { buildIssueMap, normalizeBooleanWeight, normalizeRisk } from "../utils/normalize.util.js";
import { average } from "../utils/scoring.util.js";

const RUNTIME_BREAKING_WEIGHT  = 100;
const DEPLOYMENT_BLOCKER_WEIGHT = 90;

export function detectUrgency(
  issues: readonly Issue[],
  impactScored: readonly ScoredIssue[],
): readonly ScoredIssue[] {
  const issueById = buildIssueMap(issues);

  const scored = impactScored.map((item) => {
    const issue = issueById.get(item.id);

    const urgency = average([
      normalizeBooleanWeight(issue?.runtimeBreaking, RUNTIME_BREAKING_WEIGHT),
      normalizeBooleanWeight(issue?.deploymentBlocker, DEPLOYMENT_BLOCKER_WEIGHT),
      normalizeRisk(issue?.productionRisk),
    ]);

    return Object.freeze({
      ...item,
      urgency,
    });
  });

  return Object.freeze(scored);
}
