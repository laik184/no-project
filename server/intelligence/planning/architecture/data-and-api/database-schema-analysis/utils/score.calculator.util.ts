import type { DbSchemaIssue, DbSeverity } from "../types.js";
import { DB_SCORE_START, DB_DEDUCTIONS } from "../types.js";

export function computeDbScore(
  issues: readonly DbSchemaIssue[],
): number {
  let score = DB_SCORE_START;
  for (const issue of issues) {
    score -= DB_DEDUCTIONS[issue.severity] ?? 0;
  }
  return Math.max(0, score);
}

export function countBySeverity(
  issues:   readonly DbSchemaIssue[],
  severity: DbSeverity,
): number {
  return issues.filter((i) => i.severity === severity).length;
}

export function sortBySeverity(
  issues: readonly DbSchemaIssue[],
): readonly DbSchemaIssue[] {
  const order: Record<DbSeverity, number> = {
    CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3,
  };
  return Object.freeze(
    [...issues].sort((a, b) => (order[a.severity] ?? 4) - (order[b.severity] ?? 4)),
  );
}

export function issuesByType(
  issues: readonly DbSchemaIssue[],
  type:   string,
): readonly DbSchemaIssue[] {
  return Object.freeze(issues.filter((i) => i.type === type));
}

export function issuesByFile(
  issues:   readonly DbSchemaIssue[],
  filePath: string,
): readonly DbSchemaIssue[] {
  return Object.freeze(issues.filter((i) => i.filePath === filePath));
}

export function uniqueAffectedFiles(
  issues: readonly DbSchemaIssue[],
): readonly string[] {
  return Object.freeze([...new Set(issues.map((i) => i.filePath))]);
}

export function totalRiskWeight(issues: readonly DbSchemaIssue[]): number {
  return issues.reduce((acc, i) => acc + (DB_DEDUCTIONS[i.severity] ?? 0), 0);
}

export function topIssueDensityFiles(
  issues: readonly DbSchemaIssue[],
  limit:  number = 5,
): readonly { filePath: string; count: number; maxSeverity: DbSeverity }[] {
  const fileMap = new Map<string, { count: number; maxSeverity: DbSeverity }>();
  const order: Record<DbSeverity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

  for (const issue of issues) {
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
