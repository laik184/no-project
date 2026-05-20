import type { CodeFile, DeadCodeIssue } from "../types.js";
import {
  buildReachabilityIssue,
  isMeaningfulFollowupLine,
} from "./reachability-issue-builder.util.js";

export function detectCodeAfterReturn(file: CodeFile): readonly DeadCodeIssue[] {
  const lines = file.content.split("\n");
  const issues: DeadCodeIssue[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    const hasReturn =
      /^\s*return\b/.test(line) &&
      !trimmed.endsWith(",") &&
      !trimmed.endsWith("(") &&
      !trimmed.includes("=>");

    if (!hasReturn) continue;
    const nextLineIdx = i + 1;
    if (nextLineIdx >= lines.length) continue;

    let nextMeaningful: string | null = null;
    let nextMeaningfulIdx = -1;

    for (let j = nextLineIdx; j < Math.min(nextLineIdx + 3, lines.length); j++) {
      const candidate = (lines[j] ?? "").trim();
      if (isMeaningfulFollowupLine(candidate)) {
        nextMeaningful = candidate;
        nextMeaningfulIdx = j;
        break;
      }
    }

    if (nextMeaningful !== null && nextMeaningfulIdx >= 0) {
      const braceDelta = (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
      if (braceDelta !== 0) continue;

      issues.push(
        buildReachabilityIssue({
          type: "CODE_AFTER_RETURN",
          severity: "HIGH",
          filePath: file.path,
          line: nextMeaningfulIdx + 1,
          message: `Code appears after a return statement and will never execute. This is likely leftover code from a refactor.`,
          rule: "DEAD-REACH-001",
          suggestion:
            "Remove the unreachable statements after the return, or restructure the logic so they are conditionally reachable.",
          snippet: nextMeaningful.slice(0, 120),
        }),
      );
      i = nextMeaningfulIdx;
    }
  }

  return Object.freeze(issues.slice(0, 10));
}

export function detectCodeAfterThrow(file: CodeFile): readonly DeadCodeIssue[] {
  const lines = file.content.split("\n");
  const issues: DeadCodeIssue[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const hasThrow = /^\s*throw\s+/.test(line) && !line.trim().endsWith(",");
    if (!hasThrow) continue;

    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      const candidate = (lines[j] ?? "").trim();
      if (isMeaningfulFollowupLine(candidate)) {
        issues.push(
          buildReachabilityIssue({
            type: "CODE_AFTER_THROW",
            severity: "HIGH",
            filePath: file.path,
            line: j + 1,
            message: `Code follows a throw statement and will never be executed. The throw unconditionally exits the current scope.`,
            rule: "DEAD-REACH-002",
            suggestion:
              "Remove the unreachable code after the throw statement. If the code is needed, restructure the logic to place the throw at the correct exit point.",
            snippet: candidate.slice(0, 120),
          }),
        );
        i = j;
        break;
      }
    }
  }

  return Object.freeze(issues.slice(0, 10));
}

export function detectCodeAfterProcessExit(file: CodeFile): readonly DeadCodeIssue[] {
  const lines = file.content.split("\n");
  const issues: DeadCodeIssue[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!/\bprocess\.exit\s*\(/.test(line)) continue;

    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      const candidate = (lines[j] ?? "").trim();
      if (isMeaningfulFollowupLine(candidate)) {
        issues.push(
          buildReachabilityIssue({
            type: "CODE_AFTER_PROCESS_EXIT",
            severity: "MEDIUM",
            filePath: file.path,
            line: j + 1,
            message: `Code follows a process.exit() call and will never execute. process.exit() terminates the Node.js process immediately.`,
            rule: "DEAD-REACH-004",
            suggestion:
              "Remove the unreachable code after process.exit(), or restructure to run that code before the exit call.",
            snippet: candidate.slice(0, 120),
          }),
        );
        i = j;
        break;
      }
    }
  }

  return Object.freeze(issues.slice(0, 8));
}
