import type {
  DeadCodeIssue,
  DeadCodeReport,
  DeadSeverity,
} from "../types.js";
import { MAX_DEAD_ISSUES } from "../types.js";
import {
  computeDeadScore,
  countBySeverity,
  sortBySeverity,
  topIssueDensityFiles,
} from "../utils/score.calculator.util.js";

function buildSummary(
  totalFiles:      number,
  totalIssues:     number,
  score:           number,
  criticalCount:   number,
  unusedExpCount:  number,
  orphanCount:     number,
  unreachCount:    number,
): string {
  if (totalFiles === 0) {
    return "No files provided for dead code analysis.";
  }
  if (totalIssues === 0) {
    return `Dead code analysis passed. ${totalFiles} file(s) scanned. No dead code detected. Score: ${score}/100.`;
  }

  const parts: string[] = [];
  if (unusedExpCount > 0) parts.push(`${unusedExpCount} unused export${unusedExpCount === 1 ? "" : "s"}`);
  if (orphanCount    > 0) parts.push(`${orphanCount} orphan file${orphanCount === 1 ? "" : "s"}`);
  if (unreachCount   > 0) parts.push(`${unreachCount} unreachable code path${unreachCount === 1 ? "" : "s"}`);

  const critPart = criticalCount > 0
    ? ` ${criticalCount} CRITICAL issue${criticalCount === 1 ? "" : "s"} (unreachable files) should be deleted immediately.`
    : "";

  return `${totalIssues} dead code issue${totalIssues === 1 ? "" : "s"} across ${totalFiles} file${totalFiles === 1 ? "" : "s"}: ${parts.join(", ")}.${critPart} Score: ${score}/100.`;
}

export function compileDeadCodeReport(
  reportId:        string,
  analyzedAt:      number,
  totalFiles:      number,
  unusedExpIssues: readonly DeadCodeIssue[],
  orphanIssues:    readonly DeadCodeIssue[],
  unreachIssues:   readonly DeadCodeIssue[],
): DeadCodeReport {
  const combined = [
    ...unusedExpIssues,
    ...orphanIssues,
    ...unreachIssues,
  ].slice(0, MAX_DEAD_ISSUES);

  const sorted        = sortBySeverity(combined);
  const score         = computeDeadScore(sorted);
  const criticalCount = countBySeverity(sorted, "CRITICAL");
  const highCount     = countBySeverity(sorted, "HIGH");
  const mediumCount   = countBySeverity(sorted, "MEDIUM");
  const lowCount      = countBySeverity(sorted, "LOW");

  return Object.freeze({
    reportId,
    analyzedAt,
    totalFiles,
    totalIssues:             sorted.length,
    issues:                  Object.freeze(sorted),
    unusedExportIssueCount:  unusedExpIssues.length,
    orphanIssueCount:        orphanIssues.length,
    unreachableIssueCount:   unreachIssues.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    overallScore:            score,
    isHealthy:               sorted.length === 0,
    summary:                 buildSummary(
      totalFiles, sorted.length, score, criticalCount,
      unusedExpIssues.length, orphanIssues.length, unreachIssues.length,
    ),
  });
}

export function issuesByFile(
  report:   Readonly<DeadCodeReport>,
  filePath: string,
): readonly DeadCodeIssue[] {
  return Object.freeze(report.issues.filter((i) => i.filePath === filePath));
}

export function issuesBySeverity(
  report:   Readonly<DeadCodeReport>,
  severity: DeadSeverity,
): readonly DeadCodeIssue[] {
  return Object.freeze(report.issues.filter((i) => i.severity === severity));
}

export function worstOffendingFiles(
  report: Readonly<DeadCodeReport>,
  limit:  number = 5,
): readonly { filePath: string; count: number; maxSeverity: DeadSeverity }[] {
  return topIssueDensityFiles(report.issues, limit);
}

export function hasBlockingIssues(report: Readonly<DeadCodeReport>): boolean {
  return report.criticalCount > 0;
}

export function unusedExportHealthLabel(report: Readonly<DeadCodeReport>): string {
  if (report.unusedExportIssueCount === 0) return "CLEAN";
  if (report.unusedExportIssueCount <= 3)  return "MINOR_LEAKAGE";
  return "SIGNIFICANT_LEAKAGE";
}

export function orphanHealthLabel(report: Readonly<DeadCodeReport>): string {
  if (report.orphanIssueCount === 0) return "NO_ORPHANS";
  if (report.orphanIssueCount <= 2)  return "ISOLATED_ORPHANS";
  return "ORPHAN_CLUSTER";
}

export function unreachableHealthLabel(report: Readonly<DeadCodeReport>): string {
  if (report.unreachableIssueCount === 0) return "ALL_REACHABLE";
  if (report.criticalCount         >  0)  return "STRUCTURAL_DEAD_CODE";
  return "ISOLATED_DEAD_PATHS";
}
