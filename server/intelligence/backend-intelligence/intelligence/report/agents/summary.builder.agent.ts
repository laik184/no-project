import type { GroupedIssues, ReportSection, ReportSummary } from "../types.js";

function summarizeQuickly(overallScore: number, criticalIssues: number, warnings: number): string {
  if (criticalIssues > 0) {
    return `Immediate remediation required: ${criticalIssues} critical issue(s) and ${warnings} warning(s) detected.`;
  }

  if (warnings > 0) {
    return `System is functional but needs stabilization: ${warnings} warning(s) identified.`;
  }

  if (overallScore >= 90) {
    return "Backend intelligence signals indicate strong operational health.";
  }

  return "Backend status is acceptable with opportunities for improvement.";
}

function buildStrengths(sections: readonly ReportSection[]): readonly string[] {
  const strong = sections.filter((section) => section.status === "GOOD");

  if (strong.length === 0) {
    return Object.freeze(["No major strengths detected yet; focus on action plan execution."]);
  }

  return Object.freeze(strong.map((section) => `${section.name} posture is healthy.`));
}

export function buildSummary(groupedIssues: GroupedIssues, sections: readonly ReportSection[]): ReportSummary {
  const sectionAverage = sections.length > 0
    ? Math.round(sections.reduce((sum, section) => sum + section.score, 0) / sections.length)
    : 100;

  const criticalIssues = groupedIssues.bySeverity.CRITICAL.length;
  const warnings = groupedIssues.bySeverity.HIGH.length + groupedIssues.bySeverity.MEDIUM.length;

  return Object.freeze({
    overallScore: sectionAverage,
    criticalIssues,
    warnings,
    strengths: buildStrengths(sections),
    quickSummary: summarizeQuickly(sectionAverage, criticalIssues, warnings),
  });
}
