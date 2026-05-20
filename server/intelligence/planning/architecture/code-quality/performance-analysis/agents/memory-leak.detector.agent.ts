import type {
  CodeFile,
  PerformanceIssue,
  MemoryLeakResult,
} from "../types.js";
import { isTestFile, isTypeFile } from "../utils/pattern.matcher.util.js";
import {
  hasEventListenerWithoutCleanup,
  hasIntervalWithoutClear,
  hasConnectionWithoutClose,
} from "../utils/ast.util.js";
import { matchPattern } from "../utils/pattern.matcher.util.js";

let _counter = 0;
function nextId(): string {
  _counter += 1;
  return `perf-mem-${String(_counter).padStart(4, "0")}`;
}
export function resetMemoryLeakCounter(): void { _counter = 0; }

function buildLeakIssue(
  filePath:   string,
  line:       number | null,
  snippet:    string | null,
  rule:       string,
  message:    string,
  suggestion: string,
  severity:   PerformanceIssue["severity"] = "HIGH",
): PerformanceIssue {
  return Object.freeze({
    id:         nextId(),
    type:       "MEMORY_LEAK_PATTERN" as const,
    severity,
    filePath,
    line,
    column:     null,
    message,
    rule,
    suggestion,
    snippet,
  });
}

function detectEventListenerLeaks(file: Readonly<CodeFile>): readonly PerformanceIssue[] {
  if (!hasEventListenerWithoutCleanup(file.content)) return Object.freeze([]);

  const hits = matchPattern(file.content, /addEventListener\s*\(/g);
  const firstHit = hits[0] ?? null;

  return Object.freeze([buildLeakIssue(
    file.path,
    firstHit?.line ?? null,
    firstHit?.snippet ?? null,
    "EVENT_LISTENER_WITHOUT_CLEANUP",
    "addEventListener() used without matching removeEventListener() — potential memory leak.",
    "Ensure removeEventListener() is called in cleanup (useEffect return, componentWillUnmount, or onDestroy).",
    "HIGH",
  )]);
}

function detectIntervalLeaks(file: Readonly<CodeFile>): readonly PerformanceIssue[] {
  if (!hasIntervalWithoutClear(file.content)) return Object.freeze([]);

  const hits = matchPattern(file.content, /\bsetInterval\s*\(/g);
  const firstHit = hits[0] ?? null;

  return Object.freeze([buildLeakIssue(
    file.path,
    firstHit?.line ?? null,
    firstHit?.snippet ?? null,
    "INTERVAL_WITHOUT_CLEAR",
    "setInterval() found without corresponding clearInterval() — timer leak risk.",
    "Store the interval ID and call clearInterval() in cleanup phase.",
    "HIGH",
  )]);
}

function detectConnectionLeaks(file: Readonly<CodeFile>): readonly PerformanceIssue[] {
  if (!hasConnectionWithoutClose(file.content)) return Object.freeze([]);

  const hits = matchPattern(file.content, /\.connect\s*\(|createConnection\s*\(|createPool\s*\(/g);
  const firstHit = hits[0] ?? null;

  return Object.freeze([buildLeakIssue(
    file.path,
    firstHit?.line ?? null,
    firstHit?.snippet ?? null,
    "MISSING_CONNECTION_CLEANUP",
    "DB/network connection opened without confirmed .close() or .end() — connection leak risk.",
    "Always close connections in finally{} blocks or use connection pooling with auto-release.",
    "CRITICAL",
  )]);
}

function detectGlobalCacheLeak(file: Readonly<CodeFile>): readonly PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];

  const patterns = [
    { rx: /\bcache\s*\[\s*\w+\s*\]\s*=/g,       rule: "UNBOUNDED_CACHE_WRITE",  msg: "Writing to cache[] without eviction policy — memory grows unbounded." },
    { rx: /\bcache\s*\.\s*set\s*\(\s*[^,]+,[^)]+\)/g, rule: "CACHE_SET_NO_TTL", msg: "cache.set() without TTL — cached entries may never expire." },
    { rx: /global\s*\.\s*\w+\s*=/g,             rule: "GLOBAL_STATE_MUTATION",  msg: "Direct mutation of global object — can cause unexpected memory retention." },
  ];

  for (const { rx, rule, msg } of patterns) {
    const hits = matchPattern(file.content, rx);
    for (const hit of hits.slice(0, 3)) {
      issues.push(buildLeakIssue(
        file.path,
        hit.line,
        hit.snippet,
        rule,
        msg,
        "Use a cache with max-size (LRU) or TTL-based eviction strategy.",
        "MEDIUM",
      ));
    }
  }

  return Object.freeze(issues);
}

function detectUnboundedMapSet(file: Readonly<CodeFile>): readonly PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];

  const mapHits = matchPattern(file.content, /new\s+Map\s*\(\s*\)/g);
  const setHits = matchPattern(file.content, /new\s+Set\s*\(\s*\)/g);

  const allHits = [...mapHits.slice(0, 2), ...setHits.slice(0, 2)];

  for (const hit of allHits) {
    const linesAround = file.content
      .split("\n")
      .slice(Math.max(0, (hit.line ?? 1) - 1), (hit.line ?? 1) + 10)
      .join("\n");

    const hasDelete = /\.delete\s*\(/.test(linesAround);
    const hasClear  = /\.clear\s*\(/.test(linesAround);
    if (hasDelete || hasClear) continue;

    const isModuleLevel = (hit.line ?? 0) <= 30;
    if (!isModuleLevel) continue;

    issues.push(buildLeakIssue(
      file.path,
      hit.line,
      hit.snippet,
      "UNBOUNDED_MAP_SET",
      "Module-level Map/Set without .clear() or .delete() — grows on each call.",
      "Add size limits or periodic cleanup for module-level Map/Set collections.",
      "MEDIUM",
    ));
  }

  return Object.freeze(issues);
}

export function detectMemoryLeaks(files: readonly CodeFile[]): MemoryLeakResult {
  const allIssues: PerformanceIssue[] = [];
  let filesScanned = 0;

  for (const file of files) {
    if (isTestFile(file.path) || isTypeFile(file.path)) continue;
    if (!file.content.trim()) continue;

    filesScanned += 1;

    allIssues.push(
      ...detectEventListenerLeaks(file),
      ...detectIntervalLeaks(file),
      ...detectConnectionLeaks(file),
      ...detectGlobalCacheLeak(file),
      ...detectUnboundedMapSet(file),
    );
  }

  return Object.freeze({
    issues:       Object.freeze(allIssues),
    filesScanned,
  });
}

export function memoryLeakCount(result: Readonly<MemoryLeakResult>): number {
  return result.issues.length;
}

export function criticalLeaks(
  result: Readonly<MemoryLeakResult>,
): readonly PerformanceIssue[] {
  return Object.freeze(result.issues.filter((i) => i.severity === "CRITICAL"));
}
