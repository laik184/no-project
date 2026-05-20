import type {
  TestArchIssue,
  TestArchReport,
  TestSeverity,
} from "../types.js";
import { MAX_TEST_ISSUES } from "../types.js";
import {
  computeTestScore,
  countBySeverity,
  sortBySeverity,
  topIssueDensityFiles,
} from "../utils/score.calculator.util.js";

function buildSummary(
  totalFiles:      number,
  totalIssues:     number,
  score:           number,
  criticalCount:   number,
  coverageCount:   number,
  layerCount:      number,
  ratioCount:      number,
  ratio:           number,
): string {
  if (totalFiles === 0) {
    return "No files provided for test architecture analysis.";
  }
  if (totalIssues === 0) {
    return `Test architecture analysis passed. ${totalFiles} file(s) scanned. Test-to-code ratio: ${Math.round(ratio * 100)}%. Score: ${score}/100.`;
  }

  const parts: string[] = [];
  if (coverageCount > 0) parts.push(`${coverageCount} coverage gap${coverageCount === 1 ? "" : "s"}`);
  if (layerCount    > 0) parts.push(`${layerCount} missing test layer${layerCount === 1 ? "" : "s"}`);
  if (ratioCount    > 0) parts.push(`${ratioCount} ratio issue${ratioCount === 1 ? "" : "s"}`);

  const critPart = criticalCount > 0
    ? ` ${criticalCount} CRITICAL issue${criticalCount === 1 ? "" : "s"} require immediate attention.`
    : "";

  const ratioPart = ` Test-to-code ratio: ${Math.round(ratio * 100)}%.`;

  return `${totalIssues} test architecture issue${totalIssues === 1 ? "" : "s"} across ${totalFiles} file${totalFiles === 1 ? "" : "s"}: ${parts.join(", ")}.${critPart}${ratioPart} Score: ${score}/100.`;
}

export function compileTestArchReport(
  reportId:       string,
  analyzedAt:     number,
  totalFiles:     number,
  testToCodeRatio: number,
  coverageIssues: readonly TestArchIssue[],
  layerIssues:    readonly TestArchIssue[],
  ratioIssues:    readonly TestArchIssue[],
): TestArchReport {
  const combined = [
    ...coverageIssues,
    ...layerIssues,
    ...ratioIssues,
  ].slice(0, MAX_TEST_ISSUES);

  const sorted        = sortBySeverity(combined);
  const score         = computeTestScore(sorted);
  const criticalCount = countBySeverity(sorted, "CRITICAL");
  const highCount     = countBySeverity(sorted, "HIGH");
  const mediumCount   = countBySeverity(sorted, "MEDIUM");
  const lowCount      = countBySeverity(sorted, "LOW");

  return Object.freeze({
    reportId,
    analyzedAt,
    totalFiles,
    totalIssues:         sorted.length,
    issues:              Object.freeze(sorted),
    coverageIssueCount:  coverageIssues.length,
    layerIssueCount:     layerIssues.length,
    ratioIssueCount:     ratioIssues.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    testToCodeRatio,
    overallScore:        score,
    isHealthy:           sorted.length === 0,
    summary:             buildSummary(
      totalFiles, sorted.length, score, criticalCount,
      coverageIssues.length, layerIssues.length, ratioIssues.length, testToCodeRatio,
    ),
  });
}

export function issuesByFile(
  report:   Readonly<TestArchReport>,
  filePath: string,
): readonly TestArchIssue[] {
  return Object.freeze(report.issues.filter((i) => i.filePath === filePath));
}

export function issuesBySeverity(
  report:   Readonly<TestArchReport>,
  severity: TestSeverity,
): readonly TestArchIssue[] {
  return Object.freeze(report.issues.filter((i) => i.severity === severity));
}

export function worstOffendingFiles(
  report: Readonly<TestArchReport>,
  limit:  number = 5,
): readonly { filePath: string; count: number; maxSeverity: TestSeverity }[] {
  return topIssueDensityFiles(report.issues, limit);
}

export function hasBlockingIssues(report: Readonly<TestArchReport>): boolean {
  return report.criticalCount > 0;
}

export function coverageHealthLabel(report: Readonly<TestArchReport>): string {
  if (report.coverageIssueCount === 0) return "FULLY_COVERED";
  if (report.coverageIssueCount <= 3)  return "MINOR_GAPS";
  return "SIGNIFICANT_GAPS";
}

export function layerHealthLabel(report: Readonly<TestArchReport>): string {
  if (report.layerIssueCount === 0) return "ALL_LAYERS_PRESENT";
  if (report.criticalCount   >  0)  return "CRITICAL_LAYERS_MISSING";
  return "PARTIAL_LAYERS";
}

export function ratioHealthLabel(report: Readonly<TestArchReport>): string {
  const pct = report.testToCodeRatio;
  if (pct >= 0.5)  return "EXCELLENT";
  if (pct >= 0.3)  return "ADEQUATE";
  if (pct >= 0.15) return "LOW";
  return "CRITICAL_LOW";
}
