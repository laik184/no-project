import type { ActionPlanItem, NormalizedIssue, ReportSection } from "../types.js";

const SEVERITY_ORDER: Readonly<Record<NormalizedIssue["severity"], number>> = Object.freeze({
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
});

export function sortIssues(issues: readonly NormalizedIssue[]): readonly NormalizedIssue[] {
  return Object.freeze(
    [...issues].sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        a.domain.localeCompare(b.domain) ||
        a.title.localeCompare(b.title),
    ),
  );
}

export function sortSections(sections: readonly ReportSection[]): readonly ReportSection[] {
  return Object.freeze([...sections].sort((a, b) => a.name.localeCompare(b.name)));
}

const PRIORITY_ORDER: Readonly<Record<ActionPlanItem["priority"], number>> = Object.freeze({
  P0: 0,
  P1: 1,
  P2: 2,
});

export function sortActions(actions: readonly ActionPlanItem[]): readonly ActionPlanItem[] {
  return Object.freeze([...actions].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.step.localeCompare(b.step)));
}
