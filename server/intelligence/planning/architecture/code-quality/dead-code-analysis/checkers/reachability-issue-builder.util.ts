import type { DeadCodeIssue } from "../types.js";

let _issueCounter = 0;

export function nextReachabilityId(): string {
  _issueCounter += 1;
  return `dead-reach-${Date.now()}-${String(_issueCounter).padStart(4, "0")}`;
}

export function buildReachabilityIssue(args: {
  type: DeadCodeIssue["type"];
  severity: DeadCodeIssue["severity"];
  filePath: string;
  line: number;
  message: string;
  rule: string;
  suggestion: string;
  snippet: string;
}): DeadCodeIssue {
  return Object.freeze<DeadCodeIssue>({
    id: nextReachabilityId(),
    type: args.type,
    severity: args.severity,
    filePath: args.filePath,
    line: args.line,
    column: null,
    message: args.message,
    rule: args.rule,
    suggestion: args.suggestion,
    snippet: args.snippet,
  });
}

export function isMeaningfulFollowupLine(candidate: string): boolean {
  return (
    candidate.length > 0 &&
    candidate !== "}" &&
    candidate !== "]" &&
    candidate !== ")" &&
    !candidate.startsWith("//") &&
    !candidate.startsWith("/*")
  );
}
