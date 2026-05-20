import type { Domain, GroupedIssues, ReportSection, Severity } from "../types.js";
import { SECTION_DOMAINS }  from "../types.js";
import { scoreToStatus }    from "../utils/score.util.js";

const SEVERITY_WEIGHT: Readonly<Record<Severity, number>> = Object.freeze({
  LOW:      5,
  MEDIUM:   10,
  HIGH:     20,
  CRITICAL: 35,
});

function getHighlights(
  domain:        Exclude<Domain, "General">,
  groupedIssues: GroupedIssues,
): readonly string[] {
  const issues = groupedIssues.byDomain[domain];

  if (issues.length === 0) {
    return Object.freeze([`${domain} checks are stable with no explicit issues.`]);
  }

  return Object.freeze(issues.slice(0, 3).map((issue) => `${issue.title}: ${issue.detail}`));
}

export function generateSections(groupedIssues: GroupedIssues): readonly ReportSection[] {
  const sections = SECTION_DOMAINS.map((domain) => {
    const issues  = groupedIssues.byDomain[domain];
    const penalty = issues.reduce((total, issue) => total + SEVERITY_WEIGHT[issue.severity], 0);
    const score   = Math.max(0, 100 - penalty);

    return Object.freeze({
      name:       domain,
      score,
      status:     scoreToStatus(score),
      highlights: getHighlights(domain, groupedIssues),
      issueCount: issues.length,
    });
  });

  return Object.freeze(sections);
}
