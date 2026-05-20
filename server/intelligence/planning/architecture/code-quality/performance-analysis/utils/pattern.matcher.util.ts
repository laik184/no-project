import type { CodeFile, PerformanceIssueType, IssueSeverity } from "../types.js";

export interface PatternMatch {
  readonly line:    number | null;
  readonly column:  number | null;
  readonly snippet: string | null;
  readonly matched: string;
}

export interface RuleDefinition {
  readonly pattern:    RegExp;
  readonly type:       PerformanceIssueType;
  readonly severity:   IssueSeverity;
  readonly rule:       string;
  readonly message:    string;
  readonly suggestion: string;
}

export function matchPattern(
  content: string,
  pattern: RegExp,
): readonly PatternMatch[] {
  const matches: PatternMatch[] = [];
  const lines   = content.split("\n");
  const safeRx  = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");

  let match: RegExpExecArray | null;
  while ((match = safeRx.exec(content)) !== null) {
    const before = content.slice(0, match.index);
    const line   = before.split("\n").length;
    const column = before.split("\n").pop()?.length ?? 0;
    const snippet = (lines[line - 1] ?? "").trim().slice(0, 120) || null;

    matches.push(Object.freeze({
      line,
      column,
      snippet,
      matched: match[0].slice(0, 100),
    }));

    if (matches.length >= 50) break;
  }

  return Object.freeze(matches);
}

export function matchAllRules(
  file:  Readonly<CodeFile>,
  rules: readonly RuleDefinition[],
): ReadonlyMap<RuleDefinition, readonly PatternMatch[]> {
  const result = new Map<RuleDefinition, readonly PatternMatch[]>();
  for (const rule of rules) {
    const hits = matchPattern(file.content, rule.pattern);
    if (hits.length > 0) {
      result.set(rule, hits);
    }
  }
  return result;
}

export function countPatternOccurrences(
  content: string,
  patterns: readonly RegExp[],
): number {
  let total = 0;
  for (const pattern of patterns) {
    const safeRx = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
    const matches = content.match(safeRx);
    total += matches ? matches.length : 0;
  }
  return total;
}

export function extractLineSnippet(
  content: string,
  lineNumber: number,
  contextLines: number = 0,
): string | null {
  const lines = content.split("\n");
  const start = Math.max(0, lineNumber - 1 - contextLines);
  const end   = Math.min(lines.length, lineNumber + contextLines);
  return lines.slice(start, end).join("\n").trim() || null;
}

export function hasPattern(content: string, pattern: RegExp): boolean {
  const safeRx = new RegExp(pattern.source, pattern.flags.replace("g", "") + "g");
  return safeRx.test(content);
}

export function countLines(content: string): number {
  return content.split("\n").length;
}

export function isTestFile(filePath: string): boolean {
  return (
    filePath.includes(".test.") ||
    filePath.includes(".spec.") ||
    filePath.includes("__tests__") ||
    filePath.includes("/__mocks__/")
  );
}

export function isTypeFile(filePath: string): boolean {
  return (
    filePath.endsWith(".d.ts") ||
    filePath.endsWith("types.ts") ||
    filePath.endsWith("types.js")
  );
}
