import type { CodeFile, ObservabilityIssue, ErrorHandlingResult } from "../types.js";
import {
  SWALLOWED_ERROR_PATTERNS,
  MISSING_ERROR_TYPE_PATTERNS,
  EMPTY_CATCH_PATTERNS,
  UNCAUGHT_PROMISE_PATTERNS,
} from "../types.js";
import {
  matchAllPatterns,
  countPatternMatches,
} from "../utils/pattern.matcher.util.js";

let _issueCounter = 0;
function nextId(): string {
  _issueCounter += 1;
  return `obs-err-${Date.now()}-${String(_issueCounter).padStart(4, "0")}`;
}

function detectUncaughtPromises(file: CodeFile): readonly ObservabilityIssue[] {
  const issues: ObservabilityIssue[] = [];

  const thenWithoutCatch = /\.then\s*\([^)]*\)\s*[^.]/g;
  const lines = file.content.split("\n");

  lines.forEach((line, idx) => {
    const fresh = new RegExp(thenWithoutCatch.source, "g");
    const hasThen  = /\.then\s*\(/.test(line);
    const hasCatch = /\.catch\s*\(/.test(line);
    const isChained = idx + 1 < lines.length && /^\s*\.catch\s*\(/.test(lines[idx + 1] ?? "");

    if (hasThen && !hasCatch && !isChained) {
      issues.push(
        Object.freeze<ObservabilityIssue>({
          id:         nextId(),
          type:       "UNCAUGHT_PROMISE_REJECTION",
          severity:   "HIGH",
          filePath:   file.path,
          line:       idx + 1,
          column:     null,
          message:    `Promise chain missing .catch() handler — unhandled rejections will crash or silently fail.`,
          rule:       "OBS-ERR-001",
          suggestion: "Append a .catch(err => ...) handler or wrap the call in a try/catch with async/await to ensure errors are captured and logged.",
          snippet:    line.trim().slice(0, 120),
        }),
      );
    }
  });

  return Object.freeze(issues.slice(0, 20));
}

function detectSwallowedErrors(file: CodeFile): readonly ObservabilityIssue[] {
  const matches = matchAllPatterns(file.content, SWALLOWED_ERROR_PATTERNS);
  return Object.freeze(
    matches.slice(0, 15).map((m) =>
      Object.freeze<ObservabilityIssue>({
        id:         nextId(),
        type:       "SWALLOWED_ERROR",
        severity:   "HIGH",
        filePath:   file.path,
        line:       m.line,
        column:     m.column,
        message:    `Error is caught but not logged, re-thrown, or handled — the failure is silently swallowed.`,
        rule:       "OBS-ERR-002",
        suggestion: "At minimum, log the error inside the catch block. Consider re-throwing if the caller should also be aware of the failure.",
        snippet:    m.snippet,
      }),
    ),
  );
}

function detectEmptyCatch(file: CodeFile): readonly ObservabilityIssue[] {
  const matches = matchAllPatterns(file.content, EMPTY_CATCH_PATTERNS);
  return Object.freeze(
    matches.slice(0, 10).map((m) =>
      Object.freeze<ObservabilityIssue>({
        id:         nextId(),
        type:       "EMPTY_CATCH_BLOCK",
        severity:   "CRITICAL",
        filePath:   file.path,
        line:       m.line,
        column:     m.column,
        message:    `Completely empty catch block — errors are consumed with zero visibility.`,
        rule:       "OBS-ERR-003",
        suggestion: "Empty catch blocks must at minimum log the caught error. Add: catch (err) { logger.error('Unexpected error', { err }); }",
        snippet:    m.snippet,
      }),
    ),
  );
}

function detectMissingErrorTypeCheck(file: CodeFile): readonly ObservabilityIssue[] {
  const matches = matchAllPatterns(file.content, MISSING_ERROR_TYPE_PATTERNS);
  const emptyCatchCount = countPatternMatches(file.content, EMPTY_CATCH_PATTERNS);
  const relevantMatches = matches.slice(0, 10);

  return Object.freeze(
    relevantMatches.map((m) =>
      Object.freeze<ObservabilityIssue>({
        id:         nextId(),
        type:       "MISSING_ERROR_TYPE_CHECK",
        severity:   "LOW",
        filePath:   file.path,
        line:       m.line,
        column:     m.column,
        message:    `Catch block does not type-check the error before handling it — may mishandle non-Error throws.`,
        rule:       "OBS-ERR-004",
        suggestion: "Guard with: if (err instanceof Error) to differentiate thrown errors from rejected non-Error values (strings, numbers, etc.).",
        snippet:    m.snippet,
      }),
    ),
  );
}

export function analyzeErrorHandling(
  files: readonly CodeFile[],
): ErrorHandlingResult {
  const allIssues: ObservabilityIssue[] = [];
  let uncaughtTotal  = 0;
  let swallowedTotal = 0;

  for (const file of files) {
    const uncaughtIssues  = detectUncaughtPromises(file);
    const swallowedIssues = detectSwallowedErrors(file);
    const emptyCatchIssues = detectEmptyCatch(file);
    const typeCheckIssues = detectMissingErrorTypeCheck(file);

    uncaughtTotal  += uncaughtIssues.length;
    swallowedTotal += swallowedIssues.length + emptyCatchIssues.length;

    allIssues.push(...uncaughtIssues, ...swallowedIssues, ...emptyCatchIssues, ...typeCheckIssues);
  }

  return Object.freeze({
    issues:               Object.freeze(allIssues),
    filesScanned:         files.length,
    uncaughtPromiseCount: uncaughtTotal,
    swallowedErrorCount:  swallowedTotal,
  });
}
