import { ValidationInput, ValidationIssue } from "../types";
import { normalizeError } from "../utils/error-normalizer.util";

const UNMATCHED_PATTERNS: Array<{ open: string; close: string; name: string }> = [
  { open: "{", close: "}", name: "curly brace" },
  { open: "(", close: ")", name: "parenthesis" },
  { open: "[", close: "]", name: "square bracket" },
];

const CRITICAL_PATTERNS: Array<{ pattern: RegExp; rule: string; message: string }> = [
  { pattern: /\bundefined\s*\.\s*\w+/g,       rule: "undefined-access",   message: "Potential access on undefined value." },
  { pattern: /console\.(log|warn|error)\s*\(/g, rule: "console-call",      message: "Console call found — remove before production." },
  { pattern: /debugger\s*;/g,                  rule: "debugger-statement", message: "Debugger statement detected." },
];

export function validateSyntax(input: ValidationInput): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!input.code || input.code.trim().length === 0) {
    return Object.freeze([
      Object.freeze({
        type: "syntax" as const,
        severity: "critical" as const,
        message: "Empty code submitted — nothing to validate.",
        rule: "empty-code",
      }),
    ]);
  }

  for (const bracket of UNMATCHED_PATTERNS) {
    const opens  = (input.code.split(bracket.open).length  - 1);
    const closes = (input.code.split(bracket.close).length - 1);
    if (opens !== closes) {
      issues.push(Object.freeze({
        type: "syntax" as const,
        severity: "high" as const,
        message: `Unmatched ${bracket.name}: ${opens} opening vs ${closes} closing.`,
        rule: `unmatched-${bracket.name.replace(" ", "-")}`,
      }));
    }
  }

  for (const check of CRITICAL_PATTERNS) {
    const matches = input.code.match(check.pattern);
    if (matches) {
      const severity = check.rule === "console-call" ? "low" : "medium";
      issues.push(Object.freeze({
        type: "syntax" as const,
        severity,
        message: `${check.message} (${matches.length} occurrence${matches.length > 1 ? "s" : ""})`,
        rule: check.rule,
      }));
    }
  }

  const lines = input.code.split("\n");
  const longLines = lines.filter((l) => l.length > 300);
  if (longLines.length > 0) {
    issues.push(Object.freeze({
      type: "syntax" as const,
      severity: "low" as const,
      message: `${longLines.length} line(s) exceed 300 characters — consider refactoring.`,
      rule: "line-too-long",
    }));
  }

  return Object.freeze(issues);
}
