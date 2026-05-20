import type {
  ComplexityIssue,
  ComplexityReport,
  ComplexitySeverity,
} from "../types.js";
import { MAX_COMPLEX_ISSUES } from "../types.js";
import {
  computeComplexityScore,
  countBySeverity,
  sortBySeverity,
  topIssueDensityFiles,
  topComplexFunctions,
  averageMetric,
  maxMetric,
} from "../utils/score.calculator.util.js";

function buildSummary(
  totalFiles:      number,
  totalIssues:     number,
  score:           number,
  criticalCount:   number,
  cyclomaticCount: number,
  cognitiveCount:  number,
  lengthCount:     number,
  nestingCount:    number,
  avgCC:           number,
  maxNest:         number,
): string {
  if (totalFiles === 0) {
    return "No files provided for complexity analysis.";
  }
  if (totalIssues === 0) {
    return `Complexity analysis passed. ${totalFiles} file(s) scanned. Score: ${score}/100.`;
  }

  const parts: string[] = [];
  if (cyclomaticCount > 0) parts.push(`${cyclomaticCount} cyclomatic violation${cyclomaticCount === 1 ? "" : "s"}`);
  if (cognitiveCount  > 0) parts.push(`${cognitiveCount} cognitive violation${cognitiveCount === 1 ? "" : "s"}`);
  if (lengthCount     > 0) parts.push(`${lengthCount} length violation${lengthCount === 1 ? "" : "s"}`);
  if (nestingCount    > 0) parts.push(`${nestingCount} nesting violation${nestingCount === 1 ? "" : "s"}`);

  const critPart = criticalCount > 0
    ? ` ${criticalCount} CRITICAL violation${criticalCount === 1 ? "" : "s"} require immediate refactoring.`
    : "";

  const metricPart = ` Avg cyclomatic complexity: ${avgCC}. Max nesting depth: ${maxNest}.`;

  return `${totalIssues} complexity issue${totalIssues === 1 ? "" : "s"} across ${totalFiles} file${totalFiles === 1 ? "" : "s"}: ${parts.join(", ")}.${critPart}${metricPart} Score: ${score}/100.`;
}

export function compileComplexityReport(
  reportId:         string,
  analyzedAt:       number,
  totalFiles:       number,
  cyclomaticIssues: readonly ComplexityIssue[],
  cognitiveIssues:  readonly ComplexityIssue[],
  lengthIssues:     readonly ComplexityIssue[],
  nestingIssues:    readonly ComplexityIssue[],
  avgCyclomaticComplexity: number,
  avgCognitiveComplexity:  number,
  maxCyclomaticComplexity: number,
  maxNestingDepth:         number,
): ComplexityReport {
  const combined = [
    ...cyclomaticIssues,
    ...cognitiveIssues,
    ...lengthIssues,
    ...nestingIssues,
  ].slice(0, MAX_COMPLEX_ISSUES);

  const sorted        = sortBySeverity(combined);
  const score         = computeComplexityScore(sorted);
  const criticalCount = countBySeverity(sorted, "CRITICAL");
  const highCount     = countBySeverity(sorted, "HIGH");
  const mediumCount   = countBySeverity(sorted, "MEDIUM");
  const lowCount      = countBySeverity(sorted, "LOW");

  return Object.freeze({
    reportId,
    analyzedAt,
    totalFiles,
    totalIssues:                sorted.length,
    issues:                     Object.freeze(sorted),
    cyclomaticIssueCount:       cyclomaticIssues.length,
    cognitiveIssueCount:        cognitiveIssues.length,
    functionLengthIssueCount:   lengthIssues.length,
    nestingIssueCount:          nestingIssues.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    avgCyclomaticComplexity,
    maxCyclomaticComplexity,
    avgCognitiveComplexity,
    maxNestingDepth,
    overallScore:               score,
    isHealthy:                  sorted.length === 0,
    summary:                    buildSummary(
      totalFiles, sorted.length, score, criticalCount,
      cyclomaticIssues.length, cognitiveIssues.length,
      lengthIssues.length, nestingIssues.length,
      avgCyclomaticComplexity, maxNestingDepth,
    ),
  });
}

export function issuesByFile(
  report:   Readonly<ComplexityReport>,
  filePath: string,
): readonly ComplexityIssue[] {
  return Object.freeze(report.issues.filter((i) => i.filePath === filePath));
}

export function issuesBySeverity(
  report:   Readonly<ComplexityReport>,
  severity: ComplexitySeverity,
): readonly ComplexityIssue[] {
  return Object.freeze(report.issues.filter((i) => i.severity === severity));
}

export function mostComplexFunctions(
  report: Readonly<ComplexityReport>,
  limit:  number = 5,
): readonly { functionName: string; filePath: string; metricValue: number; severity: ComplexitySeverity }[] {
  return topComplexFunctions(report.issues, limit);
}

export function worstFiles(
  report: Readonly<ComplexityReport>,
  limit:  number = 5,
): readonly { filePath: string; count: number; maxSeverity: ComplexitySeverity }[] {
  return topIssueDensityFiles(report.issues, limit);
}

export function hasBlockingIssues(report: Readonly<ComplexityReport>): boolean {
  return report.criticalCount > 0;
}

export function cyclomaticHealthLabel(report: Readonly<ComplexityReport>): string {
  const avg = report.avgCyclomaticComplexity;
  if (avg <= 5)  return "SIMPLE";
  if (avg <= 10) return "MODERATE";
  if (avg <= 20) return "COMPLEX";
  return "VERY_COMPLEX";
}

export function cognitiveHealthLabel(report: Readonly<ComplexityReport>): string {
  const avg = report.avgCognitiveComplexity;
  if (avg <= 8)  return "READABLE";
  if (avg <= 15) return "MODERATE";
  if (avg <= 30) return "DIFFICULT";
  return "UNREADABLE";
}

export function nestingHealthLabel(report: Readonly<ComplexityReport>): string {
  if (report.maxNestingDepth <= 3) return "FLAT";
  if (report.maxNestingDepth <= 5) return "MODERATE_NESTING";
  if (report.maxNestingDepth <= 7) return "DEEP_NESTING";
  return "EXTREME_NESTING";
}
