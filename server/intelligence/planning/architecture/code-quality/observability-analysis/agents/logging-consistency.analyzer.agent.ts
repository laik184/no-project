import type { CodeFile, ObservabilityIssue, LoggingConsistencyResult } from "../types.js";
import {
  RAW_CONSOLE_PATTERNS,
  STRUCTURED_LOG_LIBRARY_PATTERNS,
  MISSING_CONTEXT_PATTERNS,
  MISSING_REQUEST_ID_PATTERNS,
} from "../types.js";
import {
  matchAllPatterns,
  detectLibraries,
  hasAnyPattern,
  countPatternMatches,
} from "../utils/pattern.matcher.util.js";

let _issueCounter = 0;
function nextId(): string {
  _issueCounter += 1;
  return `obs-log-${Date.now()}-${String(_issueCounter).padStart(4, "0")}`;
}

function detectRawConsole(file: CodeFile): readonly ObservabilityIssue[] {
  const matches = matchAllPatterns(file.content, RAW_CONSOLE_PATTERNS);
  return Object.freeze(
    matches.map((m) =>
      Object.freeze<ObservabilityIssue>({
        id:         nextId(),
        type:       "RAW_CONSOLE_USAGE",
        severity:   "MEDIUM",
        filePath:   file.path,
        line:       m.line,
        column:     m.column,
        message:    `Raw console usage detected. Prefer a structured logger for consistent, queryable logs.`,
        rule:       "OBS-LOG-001",
        suggestion: "Replace console.* calls with a structured logging library (winston, pino, etc.) that supports log levels, context, and JSON output.",
        snippet:    m.snippet,
      }),
    ),
  );
}

function detectMixedLibraries(file: CodeFile): readonly ObservabilityIssue[] {
  const libs = detectLibraries(file.content, STRUCTURED_LOG_LIBRARY_PATTERNS);
  const hasConsole = hasAnyPattern(file.content, RAW_CONSOLE_PATTERNS);

  if (libs.length > 1 || (libs.length >= 1 && hasConsole)) {
    const allLibs = hasConsole ? [...libs, "console"] : libs;
    return Object.freeze([
      Object.freeze<ObservabilityIssue>({
        id:         nextId(),
        type:       "MIXED_LOG_LIBRARIES",
        severity:   "MEDIUM",
        filePath:   file.path,
        line:       null,
        column:     null,
        message:    `Multiple logging mechanisms detected: [${allLibs.join(", ")}]. Log output will be fragmented and inconsistent.`,
        rule:       "OBS-LOG-002",
        suggestion: "Standardize on a single logging library across the file and codebase to ensure consistent log format and level routing.",
        snippet:    null,
      }),
    ]);
  }
  return Object.freeze([]);
}

function detectMissingContext(file: CodeFile): readonly ObservabilityIssue[] {
  const matches = matchAllPatterns(file.content, MISSING_CONTEXT_PATTERNS);
  const issues: ObservabilityIssue[] = [];

  for (const m of matches.slice(0, 10)) {
    issues.push(
      Object.freeze<ObservabilityIssue>({
        id:         nextId(),
        type:       "MISSING_LOG_CONTEXT",
        severity:   "LOW",
        filePath:   file.path,
        line:       m.line,
        column:     m.column,
        message:    `Log statement contains only a plain string with no structured context object.`,
        rule:       "OBS-LOG-003",
        suggestion: "Include a context object as a second argument (e.g., { requestId, userId, traceId }) to make logs correlatable.",
        snippet:    m.snippet,
      }),
    );
  }
  return Object.freeze(issues);
}

function detectMissingRequestId(file: CodeFile): readonly ObservabilityIssue[] {
  const requestLogMatches = matchAllPatterns(file.content, MISSING_REQUEST_ID_PATTERNS);
  const issues: ObservabilityIssue[] = [];
  const hasRequestId = /requestId|req_id|correlationId|traceId/i.test(file.content);

  if (requestLogMatches.length > 0 && !hasRequestId) {
    issues.push(
      Object.freeze<ObservabilityIssue>({
        id:         nextId(),
        type:       "MISSING_REQUEST_ID_IN_LOG",
        severity:   "MEDIUM",
        filePath:   file.path,
        line:       requestLogMatches[0]?.line ?? null,
        column:     requestLogMatches[0]?.column ?? null,
        message:    `Log statements reference request objects but no requestId/correlationId is included for traceability.`,
        rule:       "OBS-LOG-004",
        suggestion: "Add requestId or correlationId to every log entry that is part of a request lifecycle to enable distributed tracing.",
        snippet:    requestLogMatches[0]?.snippet ?? null,
      }),
    );
  }
  return Object.freeze(issues);
}

export function analyzeLoggingConsistency(
  files: readonly CodeFile[],
): LoggingConsistencyResult {
  const allIssues: ObservabilityIssue[] = [];
  let rawConsoleTotal = 0;
  let mixedLibTotal   = 0;

  for (const file of files) {
    const rawIssues   = detectRawConsole(file);
    const mixedIssues = detectMixedLibraries(file);
    const ctxIssues   = detectMissingContext(file);
    const reqIdIssues = detectMissingRequestId(file);

    rawConsoleTotal += countPatternMatches(file.content, RAW_CONSOLE_PATTERNS);
    mixedLibTotal   += mixedIssues.length;

    allIssues.push(...rawIssues, ...mixedIssues, ...ctxIssues, ...reqIdIssues);
  }

  return Object.freeze({
    issues:          Object.freeze(allIssues),
    filesScanned:    files.length,
    rawConsoleCount: rawConsoleTotal,
    mixedLibCount:   mixedLibTotal,
  });
}
