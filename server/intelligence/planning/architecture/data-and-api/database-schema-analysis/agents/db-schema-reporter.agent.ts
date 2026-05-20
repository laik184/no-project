import type {
  DbSchemaIssue,
  DbSchemaReport,
  DbSeverity,
} from "../types.js";
import { MAX_DB_ISSUES } from "../types.js";
import {
  computeDbScore,
  countBySeverity,
  sortBySeverity,
  topIssueDensityFiles,
} from "../utils/score.calculator.util.js";

function buildSummary(
  totalFiles:      number,
  totalIssues:     number,
  score:           number,
  criticalCount:   number,
  schemaCount:     number,
  migrationCount:  number,
  ormCount:        number,
): string {
  if (totalFiles === 0) {
    return "No files provided for database schema analysis.";
  }
  if (totalIssues === 0) {
    return `Database schema analysis passed. ${totalFiles} file(s) scanned. Score: ${score}/100.`;
  }

  const parts: string[] = [];
  if (schemaCount    > 0) parts.push(`${schemaCount} schema design issue${schemaCount === 1 ? "" : "s"}`);
  if (migrationCount > 0) parts.push(`${migrationCount} migration issue${migrationCount === 1 ? "" : "s"}`);
  if (ormCount       > 0) parts.push(`${ormCount} ORM misuse issue${ormCount === 1 ? "" : "s"}`);

  const critPart = criticalCount > 0
    ? ` ${criticalCount} CRITICAL issue${criticalCount === 1 ? "" : "s"} require immediate attention.`
    : "";

  return `${totalIssues} database issue${totalIssues === 1 ? "" : "s"} across ${totalFiles} file${totalFiles === 1 ? "" : "s"}: ${parts.join(", ")}.${critPart} Score: ${score}/100.`;
}

export function compileDbSchemaReport(
  reportId:        string,
  analyzedAt:      number,
  totalFiles:      number,
  schemaIssues:    readonly DbSchemaIssue[],
  migrationIssues: readonly DbSchemaIssue[],
  ormIssues:       readonly DbSchemaIssue[],
): DbSchemaReport {
  const combined = [
    ...schemaIssues,
    ...migrationIssues,
    ...ormIssues,
  ].slice(0, MAX_DB_ISSUES);

  const sorted        = sortBySeverity(combined);
  const score         = computeDbScore(sorted);
  const criticalCount = countBySeverity(sorted, "CRITICAL");
  const highCount     = countBySeverity(sorted, "HIGH");
  const mediumCount   = countBySeverity(sorted, "MEDIUM");
  const lowCount      = countBySeverity(sorted, "LOW");

  return Object.freeze({
    reportId,
    analyzedAt,
    totalFiles,
    totalIssues:            sorted.length,
    issues:                 Object.freeze(sorted),
    schemaIssueCount:       schemaIssues.length,
    migrationIssueCount:    migrationIssues.length,
    ormIssueCount:          ormIssues.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    overallScore:           score,
    isHealthy:              sorted.length === 0,
    summary:                buildSummary(
      totalFiles, sorted.length, score, criticalCount,
      schemaIssues.length, migrationIssues.length, ormIssues.length,
    ),
  });
}

export function issuesByFile(
  report:   Readonly<DbSchemaReport>,
  filePath: string,
): readonly DbSchemaIssue[] {
  return Object.freeze(report.issues.filter((i) => i.filePath === filePath));
}

export function issuesBySeverity(
  report:   Readonly<DbSchemaReport>,
  severity: DbSeverity,
): readonly DbSchemaIssue[] {
  return Object.freeze(report.issues.filter((i) => i.severity === severity));
}

export function worstOffendingFiles(
  report: Readonly<DbSchemaReport>,
  limit:  number = 5,
): readonly { filePath: string; count: number; maxSeverity: DbSeverity }[] {
  return topIssueDensityFiles(report.issues, limit);
}

export function hasBlockingIssues(report: Readonly<DbSchemaReport>): boolean {
  return report.criticalCount > 0;
}

export function schemaHealthLabel(report: Readonly<DbSchemaReport>): string {
  if (report.schemaIssueCount === 0) return "WELL_DESIGNED";
  if (report.criticalCount    >  0)  return "CRITICAL_DESIGN_FLAWS";
  if (report.highCount        >  0)  return "SIGNIFICANT_FLAWS";
  return "MINOR_IMPROVEMENTS_NEEDED";
}

export function migrationHealthLabel(report: Readonly<DbSchemaReport>): string {
  if (report.migrationIssueCount === 0) return "FULLY_TRACKED";
  const hasCritical = report.issues
    .filter((i) => i.type === "DUPLICATE_MIGRATION_VERSION")
    .length > 0;
  return hasCritical ? "DANGEROUS_GAPS" : "PARTIAL_TRACKING";
}

export function ormHealthLabel(report: Readonly<DbSchemaReport>): string {
  if (report.ormIssueCount === 0) return "CLEAN";
  if (report.ormIssueCount <= 3) return "MINOR_MISUSE";
  return "SIGNIFICANT_MISUSE";
}
