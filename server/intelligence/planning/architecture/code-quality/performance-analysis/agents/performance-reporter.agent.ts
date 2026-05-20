import type {
  PerformanceIssue,
  PerformanceReport,
  IssueSeverity,
} from "../types.js";
import { MAX_PERF_ISSUES } from "../types.js";
import {
  computePerformanceScore,
  countBySeverity,
  sortBySeverity,
} from "../utils/score.calculator.util.js";

function buildSummary(
  totalFiles:    number,
  totalIssues:   number,
  score:         number,
  criticalCount: number,
  n1Count:       number,
  memLeakCount:  number,
  asyncCount:    number,
  dbHotCount:    number,
): string {
  if (totalFiles === 0) {
    return "No files provided for performance analysis.";
  }
  if (totalIssues === 0) {
    return `Performance analysis passed. ${totalFiles} file(s) scanned. Score: ${score}/100.`;
  }

  const parts: string[] = [];
  if (n1Count > 0)      parts.push(`${n1Count} N+1 query issue(s)`);
  if (memLeakCount > 0) parts.push(`${memLeakCount} memory leak risk(s)`);
  if (asyncCount > 0)   parts.push(`${asyncCount} async misuse(s)`);
  if (dbHotCount > 0)   parts.push(`${dbHotCount} DB hotspot(s)`);

  const critPart = criticalCount > 0 ? ` ${criticalCount} critical.` : "";
  return `${totalIssues} performance issue(s) in ${totalFiles} file(s): ${parts.join(", ")}.${critPart} Score: ${score}/100.`;
}

export function compilePerformanceReport(
  reportId:      string,
  analyzedAt:    number,
  totalFiles:    number,
  n1Issues:      readonly PerformanceIssue[],
  memIssues:     readonly PerformanceIssue[],
  asyncIssues:   readonly PerformanceIssue[],
  dbHotIssues:   readonly PerformanceIssue[],
): PerformanceReport {
  const combined = [
    ...n1Issues,
    ...memIssues,
    ...asyncIssues,
    ...dbHotIssues,
  ].slice(0, MAX_PERF_ISSUES);

  const sorted   = sortBySeverity(combined);
  const score    = computePerformanceScore(sorted);

  const criticalCount    = countBySeverity(sorted, "CRITICAL");
  const highCount        = countBySeverity(sorted, "HIGH");
  const mediumCount      = countBySeverity(sorted, "MEDIUM");
  const lowCount         = countBySeverity(sorted, "LOW");

  return Object.freeze({
    reportId,
    analyzedAt,
    totalFiles,
    totalIssues:       sorted.length,
    issues:            Object.freeze(sorted),
    n1Count:           n1Issues.length,
    memoryLeakCount:   memIssues.length,
    asyncMisuseCount:  asyncIssues.length,
    dbHotspotCount:    dbHotIssues.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    overallScore:      score,
    isPerformant:      sorted.length === 0,
    summary:           buildSummary(
      totalFiles, sorted.length, score, criticalCount,
      n1Issues.length, memIssues.length, asyncIssues.length, dbHotIssues.length,
    ),
  });
}

export function issuesByFile(
  report:   Readonly<PerformanceReport>,
  filePath: string,
): readonly PerformanceIssue[] {
  return Object.freeze(report.issues.filter((i) => i.filePath === filePath));
}

export function issuesBySeverity(
  report:   Readonly<PerformanceReport>,
  severity: IssueSeverity,
): readonly PerformanceIssue[] {
  return Object.freeze(report.issues.filter((i) => i.severity === severity));
}

export function topHotFiles(
  report:    Readonly<PerformanceReport>,
  limit:     number = 5,
): readonly { filePath: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const issue of report.issues) {
    counts.set(issue.filePath, (counts.get(issue.filePath) ?? 0) + 1);
  }
  const sorted = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([filePath, count]) => Object.freeze({ filePath, count }));
  return Object.freeze(sorted);
}

export function hasBlockingIssues(report: Readonly<PerformanceReport>): boolean {
  return report.criticalCount > 0;
}
