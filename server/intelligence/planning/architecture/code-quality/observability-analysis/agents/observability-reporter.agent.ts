import type {
  ObservabilityIssue,
  ObservabilityReport,
  ObsSeverity,
} from "../types.js";
import { MAX_OBS_ISSUES } from "../types.js";
import {
  computeObsScore,
  countBySeverity,
  sortBySeverity,
  uniqueAffectedFiles,
  topIssueDensityFiles,
} from "../utils/score.calculator.util.js";

function buildSummary(
  totalFiles:          number,
  totalIssues:         number,
  score:               number,
  criticalCount:       number,
  loggingCount:        number,
  errorCount:          number,
  monitoringCount:     number,
): string {
  if (totalFiles === 0) {
    return "No files provided for observability analysis.";
  }
  if (totalIssues === 0) {
    return `Observability analysis passed. ${totalFiles} file(s) scanned. Score: ${score}/100.`;
  }

  const parts: string[] = [];
  if (loggingCount   > 0) parts.push(`${loggingCount} logging inconsistenc${loggingCount === 1 ? "y" : "ies"}`);
  if (errorCount     > 0) parts.push(`${errorCount} error-handling gap${errorCount === 1 ? "" : "s"}`);
  if (monitoringCount > 0) parts.push(`${monitoringCount} missing monitoring hook${monitoringCount === 1 ? "" : "s"}`);

  const critPart = criticalCount > 0
    ? ` ${criticalCount} CRITICAL issue${criticalCount === 1 ? "" : "s"} require immediate attention.`
    : "";

  return `${totalIssues} observability issue${totalIssues === 1 ? "" : "s"} across ${totalFiles} file${totalFiles === 1 ? "" : "s"}: ${parts.join(", ")}.${critPart} Score: ${score}/100.`;
}

export function compileObservabilityReport(
  reportId:        string,
  analyzedAt:      number,
  totalFiles:      number,
  loggingIssues:   readonly ObservabilityIssue[],
  errorIssues:     readonly ObservabilityIssue[],
  monitoringIssues: readonly ObservabilityIssue[],
): ObservabilityReport {
  const combined = [
    ...loggingIssues,
    ...errorIssues,
    ...monitoringIssues,
  ].slice(0, MAX_OBS_ISSUES);

  const sorted        = sortBySeverity(combined);
  const score         = computeObsScore(sorted);
  const criticalCount = countBySeverity(sorted, "CRITICAL");
  const highCount     = countBySeverity(sorted, "HIGH");
  const mediumCount   = countBySeverity(sorted, "MEDIUM");
  const lowCount      = countBySeverity(sorted, "LOW");

  return Object.freeze({
    reportId,
    analyzedAt,
    totalFiles,
    totalIssues:              sorted.length,
    issues:                   Object.freeze(sorted),
    loggingIssueCount:        loggingIssues.length,
    errorHandlingIssueCount:  errorIssues.length,
    monitoringIssueCount:     monitoringIssues.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    overallScore:             score,
    isHealthy:                sorted.length === 0,
    summary:                  buildSummary(
      totalFiles, sorted.length, score, criticalCount,
      loggingIssues.length, errorIssues.length, monitoringIssues.length,
    ),
  });
}

export function issuesByFile(
  report:   Readonly<ObservabilityReport>,
  filePath: string,
): readonly ObservabilityIssue[] {
  return Object.freeze(report.issues.filter((i) => i.filePath === filePath));
}

export function issuesBySeverity(
  report:   Readonly<ObservabilityReport>,
  severity: ObsSeverity,
): readonly ObservabilityIssue[] {
  return Object.freeze(report.issues.filter((i) => i.severity === severity));
}

export function worstOffendingFiles(
  report: Readonly<ObservabilityReport>,
  limit:  number = 5,
): readonly { filePath: string; count: number; maxSeverity: ObsSeverity }[] {
  return topIssueDensityFiles(report.issues, limit);
}

export function hasBlockingIssues(report: Readonly<ObservabilityReport>): boolean {
  return report.criticalCount > 0;
}

export function loggingHealthLabel(report: Readonly<ObservabilityReport>): string {
  if (report.loggingIssueCount === 0) return "CONSISTENT";
  if (report.loggingIssueCount <= 3)  return "MINOR_GAPS";
  return "INCONSISTENT";
}

export function errorHandlingLabel(report: Readonly<ObservabilityReport>): string {
  if (report.errorHandlingIssueCount === 0) return "COVERED";
  if (report.criticalCount > 0)             return "CRITICAL_GAPS";
  if (report.highCount > 0)                 return "SIGNIFICANT_GAPS";
  return "PARTIAL";
}

export function monitoringLabel(report: Readonly<ObservabilityReport>): string {
  if (report.monitoringIssueCount === 0) return "FULLY_INSTRUMENTED";
  if (report.monitoringIssueCount <= 1)  return "PARTIALLY_INSTRUMENTED";
  return "BLIND";
}
