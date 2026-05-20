import type { Issue, ScoredIssue } from "../types.js";
import { normalizeRisk } from "../utils/normalize.util.js";
import { average, toSeverityLabel } from "../utils/scoring.util.js";

export function scoreSeverity(issues: readonly Issue[]): readonly ScoredIssue[] {
  const scored = issues.map((issue) => {
    const severity = average([
      normalizeRisk(issue.securityRisk),
      normalizeRisk(issue.dataLossRisk),
      normalizeRisk(issue.systemFailureRisk),
    ]);

    return Object.freeze({
      id: issue.id,
      severityLabel: toSeverityLabel(severity),
      severity,
      impact: 0,
      urgency: 0,
      finalScore: 0,
    });
  });

  return Object.freeze(scored);
}
