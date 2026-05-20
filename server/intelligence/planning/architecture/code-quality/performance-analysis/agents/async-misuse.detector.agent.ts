import type {
  CodeFile,
  PerformanceIssue,
  AsyncMisuseResult,
} from "../types.js";
import { isTestFile, isTypeFile, matchPattern } from "../utils/pattern.matcher.util.js";
import { extractAsyncFunctions, countAwaitCalls, extractLoopBlocks } from "../utils/ast.util.js";

let _counter = 0;
function nextId(): string {
  _counter += 1;
  return `perf-async-${String(_counter).padStart(4, "0")}`;
}
export function resetAsyncMisuseCounter(): void { _counter = 0; }

function buildAsyncIssue(
  filePath:   string,
  line:       number | null,
  snippet:    string | null,
  type:       PerformanceIssue["type"],
  severity:   PerformanceIssue["severity"],
  rule:       string,
  message:    string,
  suggestion: string,
): PerformanceIssue {
  return Object.freeze({
    id: nextId(), type, severity, filePath, line, column: null,
    message, rule, suggestion, snippet,
  });
}

function detectSequentialAwaitsInLoop(file: Readonly<CodeFile>): readonly PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];
  const loops = extractLoopBlocks(file.content);

  for (const loop of loops) {
    if (!loop.hasAwait) continue;

    const awaitCount = countAwaitCalls(loop.body);
    if (awaitCount < 2) continue;

    issues.push(buildAsyncIssue(
      file.path,
      loop.startLine,
      loop.body.split("\n")[0]?.trim().slice(0, 120) ?? null,
      "SEQUENTIAL_AWAIT_IN_LOOP",
      "HIGH",
      "SEQUENTIAL_AWAIT_IN_LOOP",
      `${awaitCount} sequential awaits inside '${loop.kind}' loop — executes serially, not in parallel.`,
      "Use Promise.all() to run independent async operations in parallel.",
    ));
  }

  return Object.freeze(issues);
}

function detectMissingAwait(file: Readonly<CodeFile>): readonly PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];

  const unawaited = [
    { rx: /(?<!await\s)(?<!return\s)(?<!const\s\w+\s*=\s*)(?<!\w)\b(prisma|db|pool|knex|mongoose)\.\w+\.\w+\s*\(/g,
      rule: "MISSING_AWAIT_DB", msg: "DB call result not awaited — may silently discard query result." },
    { rx: /(?<!await\s)fs\.(readFile|writeFile|appendFile|unlink|mkdir|stat)\s*\(/g,
      rule: "MISSING_AWAIT_FS",  msg: "Filesystem call not awaited — file operation may be skipped." },
    { rx: /(?<!await\s)fetch\s*\(/g,
      rule: "MISSING_AWAIT_FETCH", msg: "fetch() not awaited — response will be an unresolved Promise." },
  ];

  for (const { rx, rule, msg } of unawaited) {
    const hits = matchPattern(file.content, rx);
    for (const hit of hits.slice(0, 5)) {
      issues.push(buildAsyncIssue(
        file.path,
        hit.line,
        hit.snippet,
        "MISSING_AWAIT",
        "CRITICAL",
        rule,
        msg,
        "Add 'await' before the async call, or explicitly handle the returned Promise.",
      ));
    }
  }

  return Object.freeze(issues);
}

function detectUnresolvedPromises(file: Readonly<CodeFile>): readonly PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];

  const floatingPromiseRx = /(?<![=:(,])\s*(?:new\s+Promise|Promise\.all|Promise\.race|Promise\.allSettled)\s*\([^;)]*\)\s*(?!\s*\.then|\s*\.catch|\s*\.finally|\s*;|\s*\))/g;
  const hits = matchPattern(file.content, floatingPromiseRx);

  for (const hit of hits.slice(0, 5)) {
    issues.push(buildAsyncIssue(
      file.path,
      hit.line,
      hit.snippet,
      "UNRESOLVED_PROMISE",
      "HIGH",
      "FLOATING_PROMISE",
      "Promise created but not awaited or chained — errors will be silently swallowed.",
      "Await the Promise or add .catch() to handle rejections.",
    ));
  }

  return Object.freeze(issues);
}

function detectPromiseInNonAsync(file: Readonly<CodeFile>): readonly PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];

  const syncWithAwaitRx = /(?<!async\s)function\s+\w+\s*\([^)]*\)\s*\{[^}]*\bawait\b/gs;
  const hits = matchPattern(file.content, syncWithAwaitRx);

  for (const hit of hits.slice(0, 3)) {
    issues.push(buildAsyncIssue(
      file.path,
      hit.line,
      hit.snippet,
      "ASYNC_MISUSE",
      "CRITICAL",
      "AWAIT_IN_SYNC_FUNCTION",
      "'await' used inside a non-async function — will throw SyntaxError at runtime.",
      "Mark the function as 'async' or remove the 'await' keyword.",
    ));
  }

  return Object.freeze(issues);
}

function detectUnnecessaryAsyncFunctions(file: Readonly<CodeFile>): readonly PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];
  const asyncFns = extractAsyncFunctions(file.content);

  for (const fn of asyncFns) {
    if (!fn.body) continue;
    const hasAwait = /\bawait\b/.test(fn.body);
    if (hasAwait) continue;

    const hasPromise = /\bPromise\b|\bthen\b|\bcatch\b/.test(fn.body);
    if (hasPromise) continue;

    if (!fn.name) continue;

    issues.push(buildAsyncIssue(
      file.path,
      fn.startLine,
      fn.body.split("\n")[0]?.trim().slice(0, 120) ?? null,
      "ASYNC_MISUSE",
      "LOW",
      "UNNECESSARY_ASYNC",
      `Function '${fn.name}' is declared async but contains no 'await' — unnecessary overhead.`,
      "Remove 'async' keyword if the function doesn't need to await anything.",
    ));
  }

  return Object.freeze(issues);
}

export function detectAsyncMisuse(files: readonly CodeFile[]): AsyncMisuseResult {
  const allIssues: PerformanceIssue[] = [];
  let filesScanned = 0;

  for (const file of files) {
    if (isTestFile(file.path) || isTypeFile(file.path)) continue;
    if (!file.content.trim()) continue;

    filesScanned += 1;

    allIssues.push(
      ...detectSequentialAwaitsInLoop(file),
      ...detectMissingAwait(file),
      ...detectUnresolvedPromises(file),
      ...detectPromiseInNonAsync(file),
      ...detectUnnecessaryAsyncFunctions(file),
    );
  }

  return Object.freeze({
    issues:       Object.freeze(allIssues),
    filesScanned,
  });
}

export function asyncMisuseCount(result: Readonly<AsyncMisuseResult>): number {
  return result.issues.length;
}

export function criticalAsyncIssues(
  result: Readonly<AsyncMisuseResult>,
): readonly PerformanceIssue[] {
  return Object.freeze(result.issues.filter((i) => i.severity === "CRITICAL"));
}
