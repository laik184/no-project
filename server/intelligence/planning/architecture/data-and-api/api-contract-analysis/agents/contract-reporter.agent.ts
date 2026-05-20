import type {
  ApiContractIssue,
  ApiContractReport,
  ContractSeverity,
  VersioningStrategy,
} from "../types.js";
import { MAX_CONTRACT_ISSUES } from "../types.js";
import {
  computeContractScore,
  countBySeverity,
  sortBySeverity,
} from "../utils/score.calculator.util.js";

function buildSummary(
  totalFiles:     number,
  totalEndpoints: number,
  totalIssues:    number,
  score:          number,
  criticalCount:  number,
  consistency:    number,
  schema:         number,
  versioning:     number,
  breaking:       number,
  strategy:       VersioningStrategy,
): string {
  if (totalFiles === 0) {
    return "No files provided for API contract analysis.";
  }
  if (totalIssues === 0) {
    return `API contract analysis passed. ${totalEndpoints} endpoint(s) across ${totalFiles} file(s). Strategy: ${strategy}. Score: ${score}/100.`;
  }

  const parts: string[] = [];
  if (consistency > 0) parts.push(`${consistency} consistency issue(s)`);
  if (schema > 0)      parts.push(`${schema} schema violation(s)`);
  if (versioning > 0)  parts.push(`${versioning} versioning issue(s)`);
  if (breaking > 0)    parts.push(`${breaking} breaking change risk(s)`);

  const critPart = criticalCount > 0 ? ` ${criticalCount} CRITICAL.` : "";
  return `${totalIssues} API contract issue(s) across ${totalEndpoints} endpoint(s): ${parts.join(", ")}.${critPart} Versioning: ${strategy}. Score: ${score}/100.`;
}

export function compileContractReport(
  reportId:           string,
  analyzedAt:         number,
  totalFiles:         number,
  totalEndpoints:     number,
  consistencyIssues:  readonly ApiContractIssue[],
  schemaIssues:       readonly ApiContractIssue[],
  versioningIssues:   readonly ApiContractIssue[],
  breakingIssues:     readonly ApiContractIssue[],
  strategy:           VersioningStrategy,
): ApiContractReport {
  const combined = [
    ...consistencyIssues,
    ...schemaIssues,
    ...versioningIssues,
    ...breakingIssues,
  ].slice(0, MAX_CONTRACT_ISSUES);

  const sorted        = sortBySeverity(combined);
  const score         = computeContractScore(sorted);
  const criticalCount = countBySeverity(sorted, "CRITICAL");
  const highCount     = countBySeverity(sorted, "HIGH");
  const mediumCount   = countBySeverity(sorted, "MEDIUM");
  const lowCount      = countBySeverity(sorted, "LOW");

  return Object.freeze({
    reportId,
    analyzedAt,
    totalFiles,
    totalEndpoints,
    totalIssues:            sorted.length,
    issues:                 Object.freeze(sorted),
    consistencyCount:       consistencyIssues.length,
    schemaViolationCount:   schemaIssues.length,
    versioningIssueCount:   versioningIssues.length,
    breakingChangeCount:    breakingIssues.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    versioningStrategy:     strategy,
    overallScore:           score,
    isCompliant:            sorted.length === 0,
    summary:                buildSummary(
      totalFiles, totalEndpoints, sorted.length, score, criticalCount,
      consistencyIssues.length, schemaIssues.length, versioningIssues.length, breakingIssues.length,
      strategy,
    ),
  });
}

export function issuesByEndpoint(
  report:   Readonly<ApiContractReport>,
  endpoint: string,
): readonly ApiContractIssue[] {
  return Object.freeze(report.issues.filter((i) => i.endpoint === endpoint));
}

export function issuesByFile(
  report:   Readonly<ApiContractReport>,
  filePath: string,
): readonly ApiContractIssue[] {
  return Object.freeze(report.issues.filter((i) => i.filePath === filePath));
}

export function issuesBySeverity(
  report:   Readonly<ApiContractReport>,
  severity: ContractSeverity,
): readonly ApiContractIssue[] {
  return Object.freeze(report.issues.filter((i) => i.severity === severity));
}

export function topProblematicEndpoints(
  report: Readonly<ApiContractReport>,
  limit:  number = 5,
): readonly { endpoint: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const issue of report.issues) {
    if (!issue.endpoint) continue;
    counts.set(issue.endpoint, (counts.get(issue.endpoint) ?? 0) + 1);
  }
  return Object.freeze(
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([endpoint, count]) => Object.freeze({ endpoint, count })),
  );
}

export function hasBreakingChanges(report: Readonly<ApiContractReport>): boolean {
  return report.breakingChangeCount > 0;
}

export function contractHealthGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "F";
}
