import type { ApiContractIssue } from "../types.js";

let _counter = 0;

export function nextConsistencyId(): string {
  _counter += 1;
  return `api-con-${String(_counter).padStart(4, "0")}`;
}

export function resetConsistencyCounter(): void {
  _counter = 0;
}

export function buildConsistencyIssue(
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
    id: nextConsistencyId(),
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

export const CAMEL_CASE_RX = /^[a-z][a-zA-Z0-9]*$/;
