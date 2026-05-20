import type { ActionPlanItem, GroupedIssues, NormalizedIssue } from "../types.js";

function toAction(issue: NormalizedIssue): ActionPlanItem {
  if (issue.severity === "CRITICAL") {
    return Object.freeze({
      step: `Resolve critical ${issue.domain.toLowerCase()} risk: ${issue.title}.`,
      priority: "P0",
      impact: "HIGH",
    });
  }

  if (issue.severity === "HIGH") {
    return Object.freeze({
      step: `Mitigate high-severity issue in ${issue.domain.toLowerCase()}: ${issue.title}.`,
      priority: "P1",
      impact: "HIGH",
    });
  }

  return Object.freeze({
    step: `Address ${issue.domain.toLowerCase()} improvement: ${issue.title}.`,
    priority: "P2",
    impact: issue.severity === "MEDIUM" ? "MEDIUM" : "LOW",
  });
}

export function buildActionPlan(groupedIssues: GroupedIssues): readonly ActionPlanItem[] {
  if (groupedIssues.all.length === 0) {
    return Object.freeze([
      Object.freeze({
        step: "Continue continuous monitoring and keep baseline checks green.",
        priority: "P2",
        impact: "LOW",
      }),
    ]);
  }

  return Object.freeze(groupedIssues.all.slice(0, 10).map(toAction));
}
