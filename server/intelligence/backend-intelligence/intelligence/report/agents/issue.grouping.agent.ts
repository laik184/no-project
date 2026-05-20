import type { Domain, GroupedIssues, NormalizedIssue, Severity } from "../types.js";
import { ALL_SEVERITIES, ALL_DOMAINS } from "../types.js";
import { sortIssues }                  from "../utils/sort.util.js";

export function groupIssues(issues: readonly NormalizedIssue[]): GroupedIssues {
  const sorted = sortIssues(issues);

  const bySeverity: Record<Severity, NormalizedIssue[]> = {
    LOW: [], MEDIUM: [], HIGH: [], CRITICAL: [],
  };

  const byDomain: Record<Domain, NormalizedIssue[]> = {
    Architecture: [], Performance: [], Security: [],
    Database: [], Deployment: [], General: [],
  };

  const byType: Record<string, NormalizedIssue[]> = {};

  for (const issue of sorted) {
    bySeverity[issue.severity].push(issue);
    byDomain[issue.domain].push(issue);
    byType[issue.type] = [...(byType[issue.type] ?? []), issue];
  }

  const frozenBySeverity = Object.freeze(
    ALL_SEVERITIES.reduce(
      (acc, severity) => ({ ...acc, [severity]: Object.freeze([...bySeverity[severity]]) }),
      {} as Record<Severity, readonly NormalizedIssue[]>,
    ),
  );

  const frozenByDomain = Object.freeze(
    ALL_DOMAINS.reduce(
      (acc, domain) => ({ ...acc, [domain]: Object.freeze([...byDomain[domain]]) }),
      {} as Record<Domain, readonly NormalizedIssue[]>,
    ),
  );

  const frozenByType = Object.freeze(
    Object.entries(byType).reduce(
      (acc, [type, grouped]) => ({ ...acc, [type]: Object.freeze([...grouped]) }),
      {} as Record<string, readonly NormalizedIssue[]>,
    ),
  );

  return Object.freeze({
    bySeverity: frozenBySeverity,
    byDomain:   frozenByDomain,
    byType:     frozenByType,
    all:        Object.freeze([...sorted]),
  });
}
