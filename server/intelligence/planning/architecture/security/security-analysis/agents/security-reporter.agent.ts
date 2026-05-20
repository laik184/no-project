import type {
  SecurityIssue,
  SecurityReport,
  SecuritySeverity,
} from "../types.js";
import { MAX_SEC_ISSUES } from "../types.js";
import {
  computeSecurityScore,
  countBySeverity,
  sortBySeverity,
  uniqueAffectedFiles,
} from "../utils/score.calculator.util.js";

function buildSummary(
  totalFiles:          number,
  totalIssues:         number,
  score:               number,
  criticalCount:       number,
  authCount:           number,
  secretCount:         number,
  injectionCount:      number,
  rbacCount:           number,
): string {
  if (totalFiles === 0) {
    return "No files provided for security analysis.";
  }
  if (totalIssues === 0) {
    return `Security analysis passed. ${totalFiles} file(s) scanned. Score: ${score}/100.`;
  }

  const parts: string[] = [];
  if (authCount > 0)      parts.push(`${authCount} auth violation(s)`);
  if (secretCount > 0)    parts.push(`${secretCount} secret exposure(s)`);
  if (injectionCount > 0) parts.push(`${injectionCount} injection risk(s)`);
  if (rbacCount > 0)      parts.push(`${rbacCount} RBAC violation(s)`);

  const critPart = criticalCount > 0 ? ` ${criticalCount} CRITICAL issues require immediate attention.` : "";
  return `${totalIssues} security issue(s) in ${totalFiles} file(s): ${parts.join(", ")}.${critPart} Score: ${score}/100.`;
}

export function compileSecurityReport(
  reportId:       string,
  analyzedAt:     number,
  totalFiles:     number,
  authIssues:     readonly SecurityIssue[],
  secretIssues:   readonly SecurityIssue[],
  injectionIssues: readonly SecurityIssue[],
  rbacIssues:     readonly SecurityIssue[],
): SecurityReport {
  const combined = [
    ...authIssues,
    ...secretIssues,
    ...injectionIssues,
    ...rbacIssues,
  ].slice(0, MAX_SEC_ISSUES);

  const sorted        = sortBySeverity(combined);
  const score         = computeSecurityScore(sorted);
  const criticalCount = countBySeverity(sorted, "CRITICAL");
  const highCount     = countBySeverity(sorted, "HIGH");
  const mediumCount   = countBySeverity(sorted, "MEDIUM");
  const lowCount      = countBySeverity(sorted, "LOW");

  return Object.freeze({
    reportId,
    analyzedAt,
    totalFiles,
    totalIssues:          sorted.length,
    issues:               Object.freeze(sorted),
    authViolationCount:   authIssues.length,
    secretExposureCount:  secretIssues.length,
    injectionRiskCount:   injectionIssues.length,
    rbacViolationCount:   rbacIssues.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    overallScore:         score,
    isSecure:             sorted.length === 0,
    summary:              buildSummary(
      totalFiles, sorted.length, score, criticalCount,
      authIssues.length, secretIssues.length, injectionIssues.length, rbacIssues.length,
    ),
  });
}

export function issuesByFile(
  report:   Readonly<SecurityReport>,
  filePath: string,
): readonly SecurityIssue[] {
  return Object.freeze(report.issues.filter((i) => i.filePath === filePath));
}

export function issuesBySeverity(
  report:   Readonly<SecurityReport>,
  severity: SecuritySeverity,
): readonly SecurityIssue[] {
  return Object.freeze(report.issues.filter((i) => i.severity === severity));
}

export function topVulnerableFiles(
  report: Readonly<SecurityReport>,
  limit:  number = 5,
): readonly { filePath: string; count: number; maxSeverity: SecuritySeverity }[] {
  const fileMap = new Map<string, { count: number; maxSeverity: SecuritySeverity }>();
  const order: Record<SecuritySeverity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

  for (const issue of report.issues) {
    const existing = fileMap.get(issue.filePath);
    if (!existing) {
      fileMap.set(issue.filePath, { count: 1, maxSeverity: issue.severity });
    } else {
      const isBetter = (order[issue.severity] ?? 4) < (order[existing.maxSeverity] ?? 4);
      fileMap.set(issue.filePath, {
        count:       existing.count + 1,
        maxSeverity: isBetter ? issue.severity : existing.maxSeverity,
      });
    }
  }

  return Object.freeze(
    [...fileMap.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([filePath, { count, maxSeverity }]) => Object.freeze({ filePath, count, maxSeverity })),
  );
}

export function cweBreakdown(
  report: Readonly<SecurityReport>,
): readonly { cwe: string; count: number }[] {
  const cweMap = new Map<string, number>();
  for (const issue of report.issues) {
    if (!issue.cwe) continue;
    cweMap.set(issue.cwe, (cweMap.get(issue.cwe) ?? 0) + 1);
  }
  return Object.freeze(
    [...cweMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cwe, count]) => Object.freeze({ cwe, count })),
  );
}

export function hasBlockingIssues(report: Readonly<SecurityReport>): boolean {
  return report.criticalCount > 0;
}
