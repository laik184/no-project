import type {
  CodeFile,
  SecurityIssue,
  AuthEnforcementResult,
} from "../types.js";
import {
  AUTH_MIDDLEWARE_PATTERNS,
  ROUTE_DEFINITION_PATTERNS,
  ADMIN_ENDPOINT_PATTERNS,
} from "../types.js";
import {
  matchPattern,
  hasPattern,
  isTestFile,
  isTypeFile,
  isRouteFile,
} from "../utils/pattern.matcher.util.js";
import { AUTH_RULES } from "../utils/rule.engine.util.js";

let _counter = 0;
function nextId(): string {
  _counter += 1;
  return `sec-auth-${String(_counter).padStart(4, "0")}`;
}
export function resetAuthEnforcerCounter(): void { _counter = 0; }

function buildAuthIssue(
  rule:     (typeof AUTH_RULES)[keyof typeof AUTH_RULES],
  filePath: string,
  line:     number | null,
  snippet:  string | null,
): SecurityIssue {
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

function fileHasAnyAuthMiddleware(content: string): boolean {
  return AUTH_MIDDLEWARE_PATTERNS.some((rx) => hasPattern(content, rx));
}

function detectUnprotectedRoutes(file: Readonly<CodeFile>): {
  issues: readonly SecurityIssue[];
  unprotectedRoutes: readonly string[];
} {
  if (!isRouteFile(file.path)) {
    return { issues: Object.freeze([]), unprotectedRoutes: Object.freeze([]) };
  }

  const issues: SecurityIssue[] = [];
  const unprotectedRoutes: string[] = [];

  if (fileHasAnyAuthMiddleware(file.content)) {
    return { issues: Object.freeze([]), unprotectedRoutes: Object.freeze([]) };
  }

  for (const rx of ROUTE_DEFINITION_PATTERNS) {
    const hits = matchPattern(file.content, rx);
    for (const hit of hits.slice(0, 10)) {
      const routePath = hit.matched.replace(/router\.\w+\s*\(\s*/, "").slice(0, 60);
      unprotectedRoutes.push(routePath);
      issues.push(buildAuthIssue(
        AUTH_RULES["MISSING_AUTH_ON_ROUTE"]!,
        file.path,
        hit.line,
        hit.snippet,
      ));
    }
  }

  return {
    issues:            Object.freeze(issues),
    unprotectedRoutes: Object.freeze(unprotectedRoutes),
  };
}

function detectUnprotectedAdminRoutes(file: Readonly<CodeFile>): readonly SecurityIssue[] {
  const issues: SecurityIssue[] = [];

  for (const rx of ADMIN_ENDPOINT_PATTERNS) {
    const hits = matchPattern(file.content, rx);
    for (const hit of hits.slice(0, 5)) {
      const surroundingContent = file.content
        .split("\n")
        .slice(Math.max(0, (hit.line ?? 1) - 3), (hit.line ?? 1) + 5)
        .join("\n");

      const isProtected = fileHasAnyAuthMiddleware(surroundingContent);
      if (isProtected) continue;

      issues.push(buildAuthIssue(
        AUTH_RULES["UNPROTECTED_ADMIN_ROUTE"]!,
        file.path,
        hit.line,
        hit.snippet,
      ));
    }
  }

  return Object.freeze(issues);
}

function detectAuthBypassPatterns(file: Readonly<CodeFile>): readonly SecurityIssue[] {
  const issues: SecurityIssue[] = [];

  const bypassPatterns = [
    { rx: /if\s*\(\s*process\.env\.NODE_ENV\s*[!=]==?\s*['"]test['"]\s*\)\s*return/g,
      rule: AUTH_RULES["HARDCODED_AUTH_SKIP"]! },
    { rx: /if\s*\(\s*true\s*\)\s*(?:return\s+next\s*\(\s*\)|next\s*\(\s*\))/g,
      rule: AUTH_RULES["HARDCODED_AUTH_SKIP"]! },
    { rx: /\/\/\s*TODO.*auth|\/\/\s*FIXME.*auth|\/\/\s*skip.*auth/gi,
      rule: AUTH_RULES["AUTH_BYPASS_PATTERN"]! },
    { rx: /next\s*\(\s*\)\s*;?\s*\/\/\s*skip/gi,
      rule: AUTH_RULES["AUTH_BYPASS_PATTERN"]! },
    { rx: /process\.env\.SKIP_AUTH\s*===?\s*['"]true['"]/g,
      rule: AUTH_RULES["HARDCODED_AUTH_SKIP"]! },
  ];

  for (const { rx, rule } of bypassPatterns) {
    const hits = matchPattern(file.content, rx);
    for (const hit of hits.slice(0, 5)) {
      issues.push(buildAuthIssue(rule, file.path, hit.line, hit.snippet));
    }
  }

  return Object.freeze(issues);
}

export function enforceAuthLayer(files: readonly CodeFile[]): AuthEnforcementResult {
  const allIssues: SecurityIssue[] = [];
  const allUnprotected: string[] = [];
  let filesScanned = 0;

  for (const file of files) {
    if (isTestFile(file.path) || isTypeFile(file.path)) continue;
    if (!file.content.trim()) continue;

    filesScanned += 1;

    const routeResult = detectUnprotectedRoutes(file);
    const adminIssues = detectUnprotectedAdminRoutes(file);
    const bypassIssues = detectAuthBypassPatterns(file);

    allIssues.push(...routeResult.issues, ...adminIssues, ...bypassIssues);
    allUnprotected.push(...routeResult.unprotectedRoutes);
  }

  return Object.freeze({
    issues:             Object.freeze(allIssues),
    filesScanned,
    unprotectedRoutes:  Object.freeze(allUnprotected),
  });
}

export function authIssueCount(result: Readonly<AuthEnforcementResult>): number {
  return result.issues.length;
}

export function criticalAuthIssues(
  result: Readonly<AuthEnforcementResult>,
): readonly SecurityIssue[] {
  return Object.freeze(result.issues.filter((i) => i.severity === "CRITICAL"));
}
