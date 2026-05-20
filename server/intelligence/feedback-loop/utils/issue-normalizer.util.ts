import type { Issue, IssueCode, Severity } from '../types.ts';

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function normalizeSeverity(raw: string): Severity {
  const lower = raw.toLowerCase();
  if (lower === 'critical') return 'critical';
  if (lower === 'high' || lower === 'error') return 'high';
  if (lower === 'medium' || lower === 'warn' || lower === 'warning') return 'medium';
  return 'low';
}

export function normalizeCode(raw: string): IssueCode {
  const upper = raw.toUpperCase().replace(/\s+/g, '_');
  const valid: IssueCode[] = [
    'LOGICAL_ERROR',
    'INCOMPLETE_OUTPUT',
    'CONTRACT_VIOLATION',
    'SCHEMA_MISMATCH',
    'EMPTY_RESULT',
    'TIMEOUT',
  ];
  return valid.includes(upper as IssueCode) ? (upper as IssueCode) : 'UNKNOWN';
}

export function sortBySeverity(issues: Issue[]): Issue[] {
  return [...issues].sort(
    (a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity],
  );
}

export function deduplicateIssues(issues: Issue[]): Issue[] {
  const seen = new Set<string>();
  return issues.filter((i) => {
    const key = `${i.code}:${i.field ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function topSeverity(issues: Issue[]): Severity {
  if (issues.length === 0) return 'low';
  return sortBySeverity(issues)[0].severity;
}
