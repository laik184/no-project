import type {
  CodeFile,
  PerformanceIssue,
  N1DetectionResult,
} from "../types.js";
import { DB_CALL_PATTERNS, N1_LOOP_PATTERNS } from "../types.js";
import { matchPattern, isTestFile, isTypeFile } from "../utils/pattern.matcher.util.js";
import { extractLoopBlocks, containsDbCall }    from "../utils/ast.util.js";

let _counter = 0;
function nextId(): string {
  _counter += 1;
  return `perf-n1-${String(_counter).padStart(4, "0")}`;
}
export function resetN1DetectorCounter(): void { _counter = 0; }

function buildN1Issue(
  filePath: string,
  line:     number | null,
  snippet:  string | null,
  rule:     string,
  detail:   string,
): PerformanceIssue {
  return Object.freeze({
    id:         nextId(),
    type:       "N1_QUERY_PATTERN" as const,
    severity:   "CRITICAL" as const,
    filePath,
    line,
    column:     null,
    message:    detail,
    rule,
    suggestion: "Batch queries using Promise.all(), findIn(), or load all related data in a single query before the loop.",
    snippet,
  });
}

function buildUnboundedLoopIssue(
  filePath: string,
  line:     number | null,
  snippet:  string | null,
): PerformanceIssue {
  return Object.freeze({
    id:         nextId(),
    type:       "UNBOUNDED_LOOP_QUERY" as const,
    severity:   "HIGH" as const,
    filePath,
    line,
    column:     null,
    message:    "Unbounded loop with DB call detected — may execute unlimited queries.",
    rule:       "UNBOUNDED_LOOP_QUERY",
    suggestion: "Add pagination, limit, or batch processing to prevent runaway query counts.",
    snippet,
  });
}

function detectN1ViaLoopBlocks(file: Readonly<CodeFile>): readonly PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];
  const loops = extractLoopBlocks(file.content);

  for (const loop of loops) {
    if (!loop.hasAwait) continue;
    if (!containsDbCall(loop.body)) continue;

    const isHighRisk = loop.kind === "for-of" || loop.kind === "for" || loop.kind === "while";
    const isMedRisk  = loop.kind === "map" || loop.kind === "forEach";

    if (isHighRisk) {
      issues.push(buildN1Issue(
        file.path,
        loop.startLine,
        loop.body.split("\n")[0]?.trim().slice(0, 120) ?? null,
        "N1_QUERY_IN_LOOP",
        `N+1 query risk: DB call inside '${loop.kind}' loop at line ${loop.startLine}.`,
      ));
    } else if (isMedRisk) {
      issues.push(buildN1Issue(
        file.path,
        loop.startLine,
        loop.body.split("\n")[0]?.trim().slice(0, 120) ?? null,
        "N1_QUERY_IN_ARRAY_METHOD",
        `N+1 risk: awaited DB call inside '.${loop.kind}()' — each iteration hits the DB.`,
      ));
    }
  }

  return Object.freeze(issues);
}

function detectN1ViaPatterns(file: Readonly<CodeFile>): readonly PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];

  for (const pattern of N1_LOOP_PATTERNS) {
    const hits = matchPattern(file.content, pattern);
    for (const hit of hits) {
      issues.push(buildN1Issue(
        file.path,
        hit.line,
        hit.snippet,
        "N1_PATTERN_MATCH",
        `N+1 query pattern detected: DB call found inside a loop construct.`,
      ));
    }
    if (issues.length >= 20) break;
  }

  return Object.freeze(issues);
}

function detectUnboundedLoopQueries(file: Readonly<CodeFile>): readonly PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];
  const loops = extractLoopBlocks(file.content);

  for (const loop of loops) {
    if (loop.kind !== "while") continue;
    if (!loop.hasAwait) continue;
    if (!containsDbCall(loop.body)) continue;

    issues.push(buildUnboundedLoopIssue(
      file.path,
      loop.startLine,
      loop.body.split("\n")[0]?.trim().slice(0, 120) ?? null,
    ));
  }

  return Object.freeze(issues);
}

export function detectN1Queries(files: readonly CodeFile[]): N1DetectionResult {
  const allIssues: PerformanceIssue[] = [];
  let filesScanned = 0;

  for (const file of files) {
    if (isTestFile(file.path) || isTypeFile(file.path)) continue;
    if (!file.content.trim()) continue;

    filesScanned += 1;

    const loopIssues     = detectN1ViaLoopBlocks(file);
    const patternIssues  = detectN1ViaPatterns(file);
    const unboundedIssues = detectUnboundedLoopQueries(file);

    const deduped = deduplicateByLine([...loopIssues, ...patternIssues, ...unboundedIssues]);
    allIssues.push(...deduped);
  }

  return Object.freeze({
    issues:       Object.freeze(allIssues),
    filesScanned,
  });
}

function deduplicateByLine(issues: PerformanceIssue[]): PerformanceIssue[] {
  const seen = new Set<string>();
  return issues.filter((i) => {
    const key = `${i.filePath}:${i.line ?? ""}:${i.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function n1IssueCount(result: Readonly<N1DetectionResult>): number {
  return result.issues.length;
}

export function criticalN1Issues(
  result: Readonly<N1DetectionResult>,
): readonly PerformanceIssue[] {
  return Object.freeze(result.issues.filter((i) => i.severity === "CRITICAL"));
}
