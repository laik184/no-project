import type {
  CodeFile,
  SecurityIssue,
  InjectionScanResult,
} from "../types.js";
import {
  SQL_INJECTION_PATTERNS,
  XSS_PATTERNS,
  COMMAND_INJECTION_PATTERNS,
  PATH_TRAVERSAL_PATTERNS,
} from "../types.js";
import {
  matchPattern,
  isTestFile,
  isTypeFile,
} from "../utils/pattern.matcher.util.js";
import { INJECTION_RULES } from "../utils/rule.engine.util.js";

let _counter = 0;
function nextId(): string {
  _counter += 1;
  return `sec-inj-${String(_counter).padStart(4, "0")}`;
}
export function resetInjectionScannerCounter(): void { _counter = 0; }

function buildInjectionIssue(
  ruleKey:  keyof typeof INJECTION_RULES,
  filePath: string,
  line:     number | null,
  snippet:  string | null,
): SecurityIssue {
  const rule = INJECTION_RULES[ruleKey]!;
  return Object.freeze({
    id:         nextId(),
    type:       rule.type,
    severity:   rule.severity,
    filePath,
    line,
    column:     null,
    message:    rule.message,
    rule:       rule.id,
    suggestion: rule.suggestion,
    snippet,
    cwe:        rule.cwe,
  });
}

function detectSqlInjection(file: Readonly<CodeFile>): readonly SecurityIssue[] {
  const issues: SecurityIssue[] = [];

  for (const rx of SQL_INJECTION_PATTERNS) {
    const hits = matchPattern(file.content, rx);
    for (const hit of hits.slice(0, 10)) {
      issues.push(buildInjectionIssue("SQL_INJECTION", file.path, hit.line, hit.snippet));
    }
  }

  const stringConcatRx = /(?:query|execute|raw)\s*\(\s*(?:"[^"]*"|'[^']*')\s*\+\s*(?:req|params|body|query|user)\./g;
  const concatHits = matchPattern(file.content, stringConcatRx);
  for (const hit of concatHits.slice(0, 5)) {
    issues.push(buildInjectionIssue("SQL_INJECTION", file.path, hit.line, hit.snippet));
  }

  return Object.freeze(deduplicateByLine(issues));
}

function detectXss(file: Readonly<CodeFile>): readonly SecurityIssue[] {
  const issues: SecurityIssue[] = [];

  for (const rx of XSS_PATTERNS) {
    const hits = matchPattern(file.content, rx);
    for (const hit of hits.slice(0, 10)) {
      issues.push(buildInjectionIssue("XSS_RISK", file.path, hit.line, hit.snippet));
    }
  }

  const templateLiteralRx = /res\.(send|write|end)\s*\(\s*`[^`]*\$\{(?:req|body|params|query|user)\.[^}]+\}[^`]*`\s*\)/g;
  const templateHits = matchPattern(file.content, templateLiteralRx);
  for (const hit of templateHits.slice(0, 5)) {
    issues.push(Object.freeze({
      id:         nextId(),
      type:       "XSS_VULNERABILITY" as const,
      severity:   "HIGH" as const,
      filePath:   file.path,
      line:       hit.line,
      column:     null,
      message:    "User-controlled data interpolated directly in HTTP response via template literal — reflected XSS risk.",
      rule:       "INJ-002a",
      suggestion: "Escape or sanitize all user-controlled values before including them in HTTP responses.",
      snippet:    hit.snippet,
      cwe:        "CWE-79",
    }));
  }

  return Object.freeze(deduplicateByLine(issues));
}

function detectCommandInjection(file: Readonly<CodeFile>): readonly SecurityIssue[] {
  const issues: SecurityIssue[] = [];

  for (const rx of COMMAND_INJECTION_PATTERNS) {
    const hits = matchPattern(file.content, rx);
    for (const hit of hits.slice(0, 10)) {
      issues.push(buildInjectionIssue("COMMAND_INJECTION", file.path, hit.line, hit.snippet));
    }
  }

  const shellTrueRx = /\bspawn\b[^;]*\bshell\s*:\s*true/g;
  const shellHits = matchPattern(file.content, shellTrueRx);
  for (const hit of shellHits.slice(0, 5)) {
    issues.push(Object.freeze({
      id:         nextId(),
      type:       "COMMAND_INJECTION_RISK" as const,
      severity:   "HIGH" as const,
      filePath:   file.path,
      line:       hit.line,
      column:     null,
      message:    "spawn() called with { shell: true } — allows shell metacharacter injection.",
      rule:       "INJ-003a",
      suggestion: "Use { shell: false } (default) and pass arguments as an array, not a string.",
      snippet:    hit.snippet,
      cwe:        "CWE-78",
    }));
  }

  return Object.freeze(deduplicateByLine(issues));
}

function detectPathTraversal(file: Readonly<CodeFile>): readonly SecurityIssue[] {
  const issues: SecurityIssue[] = [];

  for (const rx of PATH_TRAVERSAL_PATTERNS) {
    const hits = matchPattern(file.content, rx);
    for (const hit of hits.slice(0, 10)) {
      const snippet = hit.snippet ?? "";
      const hasNormalization = /normalize|resolve|join.*__dirname|sanitize/.test(snippet);
      if (hasNormalization) continue;

      issues.push(buildInjectionIssue("PATH_TRAVERSAL", file.path, hit.line, hit.snippet));
    }
  }

  const dotdotRx = /\.\.\/|\.\.\\|%2e%2e/gi;
  const dotdotHits = matchPattern(file.content, dotdotRx);
  for (const hit of dotdotHits.slice(0, 3)) {
    issues.push(Object.freeze({
      id:         nextId(),
      type:       "PATH_TRAVERSAL_RISK" as const,
      severity:   "HIGH" as const,
      filePath:   file.path,
      line:       hit.line,
      column:     null,
      message:    "Literal '../' or URL-encoded path traversal sequence found in source — possible traversal string.",
      rule:       "INJ-004a",
      suggestion: "Validate paths using path.resolve() and verify they remain within the allowed base directory.",
      snippet:    hit.snippet,
      cwe:        "CWE-22",
    }));
  }

  return Object.freeze(deduplicateByLine(issues));
}

function deduplicateByLine(issues: SecurityIssue[]): SecurityIssue[] {
  const seen = new Set<string>();
  return issues.filter((i) => {
    const key = `${i.filePath}:${i.line ?? ""}:${i.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function scanForInjections(files: readonly CodeFile[]): InjectionScanResult {
  const allIssues: SecurityIssue[] = [];
  let filesScanned = 0;
  let sqlRiskCount = 0;
  let xssRiskCount = 0;

  for (const file of files) {
    if (isTestFile(file.path) || isTypeFile(file.path)) continue;
    if (!file.content.trim()) continue;

    filesScanned += 1;

    const sqlIssues  = detectSqlInjection(file);
    const xssIssues  = detectXss(file);
    const cmdIssues  = detectCommandInjection(file);
    const pathIssues = detectPathTraversal(file);

    sqlRiskCount += sqlIssues.length;
    xssRiskCount += xssIssues.length;

    allIssues.push(...sqlIssues, ...xssIssues, ...cmdIssues, ...pathIssues);
  }

  return Object.freeze({
    issues:       Object.freeze(allIssues),
    filesScanned,
    sqlRiskCount,
    xssRiskCount,
  });
}

export function injectionIssueCount(result: Readonly<InjectionScanResult>): number {
  return result.issues.length;
}

export function criticalInjectionIssues(
  result: Readonly<InjectionScanResult>,
): readonly SecurityIssue[] {
  return Object.freeze(result.issues.filter((i) => i.severity === "CRITICAL"));
}
