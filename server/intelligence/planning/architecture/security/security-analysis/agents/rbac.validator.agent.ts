import type {
  CodeFile,
  SecurityIssue,
  RbacValidationResult,
} from "../types.js";
import {
  AUTH_MIDDLEWARE_PATTERNS,
  RBAC_ROLE_CHECK_PATTERNS,
} from "../types.js";
import {
  matchPattern,
  hasPattern,
  isTestFile,
  isTypeFile,
  isControllerFile,
  isRouteFile,
} from "../utils/pattern.matcher.util.js";
import { RBAC_RULES } from "../utils/rule.engine.util.js";

let _counter = 0;
function nextId(): string {
  _counter += 1;
  return `sec-rbac-${String(_counter).padStart(4, "0")}`;
}
export function resetRbacValidatorCounter(): void { _counter = 0; }

function buildRbacIssue(
  ruleKey:  keyof typeof RBAC_RULES,
  filePath: string,
  line:     number | null,
  snippet:  string | null,
): SecurityIssue {
  const rule = RBAC_RULES[ruleKey]!;
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

function fileHasAnyRoleCheck(content: string): boolean {
  return RBAC_ROLE_CHECK_PATTERNS.some((rx) => hasPattern(content, rx));
}

function fileHasAuthMiddleware(content: string): boolean {
  return AUTH_MIDDLEWARE_PATTERNS.some((rx) => hasPattern(content, rx));
}

function detectMissingRoleChecks(file: Readonly<CodeFile>): {
  issues: readonly SecurityIssue[];
  missingCount: number;
} {
  if (!isRouteFile(file.path) && !isControllerFile(file.path)) {
    return { issues: Object.freeze([]), missingCount: 0 };
  }

  const hasAuth     = fileHasAuthMiddleware(file.content);
  const hasRoleCheck = fileHasAnyRoleCheck(file.content);

  if (!hasAuth || hasRoleCheck) {
    return { issues: Object.freeze([]), missingCount: 0 };
  }

  const adminRouteRx = /['"`]\/(?:admin|management|internal|superuser)[/'"`]/g;
  const adminHits = matchPattern(file.content, adminRouteRx);

  const issues: SecurityIssue[] = [];
  for (const hit of adminHits.slice(0, 5)) {
    issues.push(buildRbacIssue("MISSING_ROLE_CHECK", file.path, hit.line, hit.snippet));
  }

  if (issues.length === 0 && hasAuth) {
    const routeHits = matchPattern(file.content, /router\.(post|put|patch|delete)\s*\(\s*['"`]/g);
    for (const hit of routeHits.slice(0, 3)) {
      issues.push(buildRbacIssue("MISSING_ROLE_CHECK", file.path, hit.line, hit.snippet));
    }
  }

  return {
    issues:       Object.freeze(issues),
    missingCount: issues.length,
  };
}

function detectDirectRoleComparisons(file: Readonly<CodeFile>): readonly SecurityIssue[] {
  const issues: SecurityIssue[] = [];

  const directRoleRx = [
    /user\.role\s*===?\s*['"`]admin['"`]/g,
    /user\.role\s*===?\s*['"`]superuser['"`]/g,
    /req\.user\.role\s*!==?\s*['"`]/g,
    /if\s*\(\s*role\s*===?\s*['"`][^'"`,]+['"`]\s*\)/g,
  ];

  for (const rx of directRoleRx) {
    const hits = matchPattern(file.content, rx);
    for (const hit of hits.slice(0, 5)) {
      issues.push(buildRbacIssue("DIRECT_ROLE_COMPARISON", file.path, hit.line, hit.snippet));
    }
  }

  return Object.freeze(deduplicateByLine(issues));
}

function detectPrivilegeEscalation(file: Readonly<CodeFile>): readonly SecurityIssue[] {
  const issues: SecurityIssue[] = [];

  const selfRoleModifyRx = [
    /(?:req\.body|body|payload)\s*\.\s*role\s*(?!===?)/g,
    /user\.update\s*\([^)]*\brole\b/g,
    /findByIdAndUpdate\s*\([^)]*\brole\b[^)]*req\.body/g,
    /\.save\s*\(\s*\)\s*;[^}]*role\s*:/g,
    /update\s*\(\s*\{[^}]*role\s*:\s*req\.body/g,
  ];

  for (const rx of selfRoleModifyRx) {
    const hits = matchPattern(file.content, rx);
    for (const hit of hits.slice(0, 5)) {
      const snippet    = hit.snippet ?? "";
      const isGuarded  = fileHasAnyRoleCheck(
        file.content.split("\n").slice(Math.max(0, (hit.line ?? 1) - 5), (hit.line ?? 1) + 5).join("\n"),
      );
      if (isGuarded) continue;

      issues.push(buildRbacIssue("PRIVILEGE_ESCALATION", file.path, hit.line, hit.snippet));
    }
  }

  return Object.freeze(deduplicateByLine(issues));
}

function detectIdorRisk(file: Readonly<CodeFile>): readonly SecurityIssue[] {
  const issues: SecurityIssue[] = [];

  const idorPatterns = [
    /findById\s*\(\s*req\.params\.\w+\s*\)/g,
    /findOne\s*\(\s*\{\s*(?:id|_id)\s*:\s*req\.params/g,
    /where\s*\(\s*\{\s*(?:id|userId)\s*:\s*req\.params/g,
    /getById\s*\(\s*req\.params\.\w+\s*\)/g,
  ];

  for (const rx of idorPatterns) {
    const hits = matchPattern(file.content, rx);
    for (const hit of hits.slice(0, 5)) {
      const surrounding = file.content
        .split("\n")
        .slice(Math.max(0, (hit.line ?? 1) - 3), (hit.line ?? 1) + 8)
        .join("\n");

      const hasOwnershipCheck = /req\.user\.(id|_id|userId)|createdBy|ownedBy|userId\s*===?\s*req\.user/.test(surrounding);
      if (hasOwnershipCheck) continue;

      issues.push(buildRbacIssue("IDOR_RISK", file.path, hit.line, hit.snippet));
    }
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

export function validateRbac(files: readonly CodeFile[]): RbacValidationResult {
  const allIssues: SecurityIssue[] = [];
  let filesScanned    = 0;
  let missingRoleChecks = 0;

  for (const file of files) {
    if (isTestFile(file.path) || isTypeFile(file.path)) continue;
    if (!file.content.trim()) continue;

    filesScanned += 1;

    const roleResult       = detectMissingRoleChecks(file);
    const directIssues     = detectDirectRoleComparisons(file);
    const escalationIssues = detectPrivilegeEscalation(file);
    const idorIssues       = detectIdorRisk(file);

    allIssues.push(
      ...roleResult.issues,
      ...directIssues,
      ...escalationIssues,
      ...idorIssues,
    );
    missingRoleChecks += roleResult.missingCount;
  }

  return Object.freeze({
    issues:            Object.freeze(allIssues),
    filesScanned,
    missingRoleChecks,
  });
}

export function rbacIssueCount(result: Readonly<RbacValidationResult>): number {
  return result.issues.length;
}

export function criticalRbacIssues(
  result: Readonly<RbacValidationResult>,
): readonly SecurityIssue[] {
  return Object.freeze(result.issues.filter((i) => i.severity === "CRITICAL"));
}
