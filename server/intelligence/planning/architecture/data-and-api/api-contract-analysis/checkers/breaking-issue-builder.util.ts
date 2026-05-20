import type { ApiContractIssue } from "../types.js";

let _counter = 0;

export function nextBreakingId(): string {
  _counter += 1;
  return `api-break-${String(_counter).padStart(4, "0")}`;
}

export function resetBreakingChangeCounter(): void {
  _counter = 0;
}

export function buildBreakingIssue(
  type: ApiContractIssue["type"],
  severity: ApiContractIssue["severity"],
  filePath: string,
  line: number | null,
  endpoint: string | null,
  rule: string,
  message: string,
  suggestion: string,
  snippet: string | null = null,
): ApiContractIssue {
  return Object.freeze({
    id: nextBreakingId(),
    type,
    severity,
    filePath,
    line,
    endpoint,
    message,
    rule,
    suggestion,
    snippet,
  });
}
