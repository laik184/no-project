import { ValidationIssue, IssueType, IssueSeverity } from "../types";

export function normalizeError(
  err: unknown,
  type: IssueType,
  defaultSeverity: IssueSeverity = "high"
): ValidationIssue {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
      ? err
      : "Unknown error occurred";

  return Object.freeze({
    type,
    severity: defaultSeverity,
    message,
    rule: "exception-caught",
  });
}

export function normalizeIssues(issues: ValidationIssue[]): readonly ValidationIssue[] {
  return Object.freeze(
    issues.map((issue) =>
      Object.freeze({
        ...issue,
        message: issue.message.trim().slice(0, 500),
      })
    )
  );
}

export function deduplicateIssues(issues: readonly ValidationIssue[]): readonly ValidationIssue[] {
  const seen = new Set<string>();
  const result: ValidationIssue[] = [];
  for (const issue of issues) {
    const key = `${issue.type}:${issue.rule ?? ""}:${issue.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(issue);
    }
  }
  return Object.freeze(result);
}
