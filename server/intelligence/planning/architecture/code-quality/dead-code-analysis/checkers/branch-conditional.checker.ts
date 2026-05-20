import type { CodeFile, DeadCodeIssue } from "../types.js";
import { DEAD_CONDITIONAL_PATTERNS } from "../types.js";
import { matchAllPatterns } from "../utils/pattern.matcher.util.js";
import { buildReachabilityIssue } from "./reachability-issue-builder.util.js";

export function detectDeadConditionals(file: CodeFile): readonly DeadCodeIssue[] {
  const matches = matchAllPatterns(file.content, DEAD_CONDITIONAL_PATTERNS);
  return Object.freeze(
    matches.slice(0, 8).map((m) =>
      buildReachabilityIssue({
        type: "DEAD_CONDITIONAL",
        severity: "MEDIUM",
        filePath: file.path,
        line: m.line,
        message: `Statically dead conditional detected (e.g., if(false), while(false), if(true)...else). The branch body is always skipped or the else is never reached.`,
        rule: "DEAD-REACH-003",
        suggestion:
          "Remove the dead branch entirely. If it is used for debugging or feature flags, replace it with a proper environment variable check (e.g., process.env.FEATURE_X === 'true').",
        snippet: m.snippet,
      }),
    ),
  );
}

export function detectUnreachableBranch(file: CodeFile): readonly DeadCodeIssue[] {
  const lines = file.content.split("\n");
  const issues: DeadCodeIssue[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";

    const isSwitchDefault = /\bdefault\s*:/.test(line);
    if (!isSwitchDefault) continue;

    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      const candidate = (lines[j] ?? "").trim();
      if (/\bthrow\s+new\s+Error\s*\(.*never/.test(candidate)) break;
      if (/\breturn\b/.test(candidate) || /\bbreak\b/.test(candidate)) break;
    }

    const switchContext = file.content.slice(
      Math.max(0, file.content.lastIndexOf("switch", file.content.indexOf(line))),
      file.content.indexOf(line) + 200,
    );

    const hasExhaustiveCheck =
      /never/.test(switchContext) ||
      /assertNever/.test(switchContext) ||
      /exhaustive/.test(switchContext);

    if (!hasExhaustiveCheck && i > 0) {
      const prevCaseLines = lines.slice(Math.max(0, i - 20), i);
      const caseCount = prevCaseLines.filter((l) => /\bcase\b/.test(l)).length;

      if (caseCount === 0) {
        issues.push(
          buildReachabilityIssue({
            type: "UNREACHABLE_BRANCH",
            severity: "LOW",
            filePath: file.path,
            line: i + 1,
            message:
              "Switch default branch may be unreachable if all enum values are explicitly handled. Consider adding an exhaustiveness check.",
            rule: "DEAD-REACH-005",
            suggestion:
              "Add a TypeScript exhaustiveness check: default: { const _: never = value; throw new Error(`Unhandled case: ${value}`); }",
            snippet: line.trim().slice(0, 120),
          }),
        );
      }
    }
  }

  return Object.freeze(issues.slice(0, 5));
}
