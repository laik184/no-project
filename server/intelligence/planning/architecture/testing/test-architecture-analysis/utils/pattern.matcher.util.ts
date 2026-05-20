import type { CodeFile } from "../types.js";
import {
  TEST_FILE_PATTERNS,
  SOURCE_EXCLUDE_PATTERNS,
  SOURCE_FILE_PATTERNS,
} from "../types.js";

export interface PatternMatch {
  readonly pattern: string;
  readonly line:    number | null;
  readonly column:  number | null;
  readonly snippet: string;
}

export function matchAllPatterns(
  content:  string,
  patterns: readonly RegExp[],
): PatternMatch[] {
  const results: PatternMatch[] = [];
  const lines   = content.split("\n");

  for (const rx of patterns) {
    const fresh = new RegExp(rx.source, rx.flags.includes("g") ? rx.flags : rx.flags + "g");
    let match: RegExpExecArray | null;

    while ((match = fresh.exec(content)) !== null) {
      const beforeMatch = content.slice(0, match.index);
      const lineNum     = beforeMatch.split("\n").length;
      const lastNl      = beforeMatch.lastIndexOf("\n");
      const col         = match.index - (lastNl === -1 ? 0 : lastNl + 1);

      results.push(Object.freeze({
        pattern: rx.source,
        line:    lineNum,
        column:  col,
        snippet: (lines[lineNum - 1] ?? "").trim().slice(0, 120),
      }));
    }
  }

  return results;
}

export function hasAnyPattern(
  content:  string,
  patterns: readonly RegExp[],
): boolean {
  return patterns.some((rx) => {
    const fresh = new RegExp(rx.source, rx.flags);
    return fresh.test(content);
  });
}

export function countPatternMatches(
  content:  string,
  patterns: readonly RegExp[],
): number {
  let total = 0;
  for (const rx of patterns) {
    const fresh = new RegExp(rx.source, rx.flags.includes("g") ? rx.flags : rx.flags + "g");
    const m = content.match(fresh);
    if (m) total += m.length;
  }
  return total;
}

export function detectLibraries(
  content:  string,
  patterns: ReadonlyArray<{ rx: RegExp; label: string }>,
): readonly string[] {
  const found = new Set<string>();
  for (const { rx, label } of patterns) {
    const fresh = new RegExp(rx.source, rx.flags.includes("g") ? rx.flags : rx.flags + "g");
    if (fresh.test(content)) found.add(label);
  }
  return Object.freeze([...found]);
}

export function isTestFile(file: CodeFile): boolean {
  return TEST_FILE_PATTERNS.some((rx) => {
    const fresh = new RegExp(rx.source, rx.flags);
    return fresh.test(file.path);
  });
}

export function isSourceFile(file: CodeFile): boolean {
  const isSource = SOURCE_FILE_PATTERNS.some((rx) => {
    const fresh = new RegExp(rx.source, rx.flags);
    return fresh.test(file.path);
  });
  if (!isSource) return false;

  return !SOURCE_EXCLUDE_PATTERNS.some((rx) => {
    const fresh = new RegExp(rx.source, rx.flags);
    return fresh.test(file.path);
  });
}

export function deriveSourceBaseName(testPath: string): string {
  return testPath
    .replace(/\.test\.(ts|js|tsx|jsx)$/i, ".$1")
    .replace(/\.spec\.(ts|js|tsx|jsx)$/i, ".$1")
    .replace(/__tests__\//i, "")
    .replace(/\/tests?\//i, "/")
    .replace(/\/test\//i, "/")
    .split("/")
    .pop() ?? "";
}

export function countNonEmptyLines(content: string): number {
  return content.split("\n").filter((l) => l.trim().length > 0).length;
}
