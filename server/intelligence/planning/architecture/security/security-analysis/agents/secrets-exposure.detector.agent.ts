import type {
  CodeFile,
  SecurityIssue,
  SecretsDetectionResult,
} from "../types.js";
import { SECRET_PATTERNS, LOG_SECRET_PATTERNS } from "../types.js";
import {
  matchPattern,
  isTestFile,
  isTypeFile,
  isConfigFile,
} from "../utils/pattern.matcher.util.js";
import { SECRET_RULES } from "../utils/rule.engine.util.js";

let _counter = 0;
function nextId(): string {
  _counter += 1;
  return `sec-secret-${String(_counter).padStart(4, "0")}`;
}
export function resetSecretsDetectorCounter(): void { _counter = 0; }

function buildSecretIssue(
  filePath:   string,
  line:       number | null,
  snippet:    string | null,
  ruleKey:    keyof typeof SECRET_RULES,
  label:      string,
  cwe:        string | null = null,
): SecurityIssue {
  const rule = SECRET_RULES[ruleKey]!;
  return Object.freeze({
    id:         nextId(),
    type:       rule.type,
    severity:   rule.severity,
    filePath,
    line,
    column:     null,
    message:    `${rule.message} (${label})`,
    rule:       rule.id,
    suggestion: rule.suggestion,
    snippet:    redactSnippet(snippet),
    cwe:        cwe ?? rule.cwe,
  });
}

function redactSnippet(snippet: string | null): string | null {
  if (!snippet) return null;
  return snippet
    .replace(/(['"])([A-Za-z0-9+/=_\-]{8,})\1/g, "'[REDACTED]'")
    .replace(/(password|secret|token|key|credential)\s*[:=]\s*\S+/gi, "$1=[REDACTED]");
}

function detectHardcodedSecrets(file: Readonly<CodeFile>): {
  issues: readonly SecurityIssue[];
  exposedTypes: readonly string[];
} {
  const issues: SecurityIssue[] = [];
  const exposedTypes: string[] = [];

  for (const { rx, label, cwe } of SECRET_PATTERNS) {
    const hits = matchPattern(file.content, rx);
    for (const hit of hits.slice(0, 5)) {
      issues.push(buildSecretIssue(
        file.path,
        hit.line,
        hit.snippet,
        label === "EMBEDDED_PRIVATE_KEY" ? "PRIVATE_KEY_EMBEDDED" : "HARDCODED_CREDENTIAL",
        label,
        cwe,
      ));
      if (!exposedTypes.includes(label)) exposedTypes.push(label);
    }
  }

  return {
    issues:       Object.freeze(issues),
    exposedTypes: Object.freeze(exposedTypes),
  };
}

function detectSecretsInLogs(file: Readonly<CodeFile>): readonly SecurityIssue[] {
  const issues: SecurityIssue[] = [];

  for (const rx of LOG_SECRET_PATTERNS) {
    const hits = matchPattern(file.content, rx);
    for (const hit of hits.slice(0, 5)) {
      issues.push(buildSecretIssue(
        file.path,
        hit.line,
        hit.snippet,
        "SECRET_IN_LOG",
        "SECRET_IN_LOG",
        "CWE-532",
      ));
    }
  }

  return Object.freeze(issues);
}

function detectProcessEnvDirectAssignment(file: Readonly<CodeFile>): readonly SecurityIssue[] {
  const issues: SecurityIssue[] = [];

  const processEnvRx = /process\.env\.\w+\s*=\s*['"][^'"]{4,}['"]/g;
  const hits = matchPattern(file.content, processEnvRx);

  for (const hit of hits.slice(0, 5)) {
    issues.push(Object.freeze({
      id:         nextId(),
      type:       "SECRET_EXPOSURE" as const,
      severity:   "HIGH" as const,
      filePath:   file.path,
      line:       hit.line,
      column:     null,
      message:    "process.env variable assigned a hardcoded string value — secrets should come from the environment, not code.",
      rule:       "SEC-004",
      suggestion: "Remove hardcoded values from process.env assignments. Use .env files with a secrets manager.",
      snippet:    redactSnippet(hit.snippet),
      cwe:        "CWE-798",
    }));
  }

  return Object.freeze(issues);
}

function detectSecretsInComments(file: Readonly<CodeFile>): readonly SecurityIssue[] {
  const issues: SecurityIssue[] = [];

  const commentSecretRx = /\/\/.*(?:password|secret|token|api.?key)\s*[:=]\s*\S+/gi;
  const hits = matchPattern(file.content, commentSecretRx);

  for (const hit of hits.slice(0, 3)) {
    issues.push(Object.freeze({
      id:         nextId(),
      type:       "HARDCODED_CREDENTIAL" as const,
      severity:   "MEDIUM" as const,
      filePath:   file.path,
      line:       hit.line,
      column:     null,
      message:    "Potential secret value found in code comment — comments are not secure storage.",
      rule:       "SEC-005",
      suggestion: "Remove credential references from comments entirely. Never store secrets in comments.",
      snippet:    redactSnippet(hit.snippet),
      cwe:        "CWE-615",
    }));
  }

  return Object.freeze(issues);
}

export function detectSecretsExposure(files: readonly CodeFile[]): SecretsDetectionResult {
  const allIssues: SecurityIssue[] = [];
  const allExposedTypes: string[] = [];
  let filesScanned = 0;

  for (const file of files) {
    if (isTestFile(file.path)) continue;
    if (isConfigFile(file.path)) continue;
    if (!file.content.trim()) continue;

    filesScanned += 1;

    const hardcodedResult = detectHardcodedSecrets(file);
    const logIssues       = detectSecretsInLogs(file);
    const envIssues       = detectProcessEnvDirectAssignment(file);
    const commentIssues   = detectSecretsInComments(file);

    allIssues.push(
      ...hardcodedResult.issues,
      ...logIssues,
      ...envIssues,
      ...commentIssues,
    );

    for (const t of hardcodedResult.exposedTypes) {
      if (!allExposedTypes.includes(t)) allExposedTypes.push(t);
    }
  }

  return Object.freeze({
    issues:             Object.freeze(allIssues),
    filesScanned,
    exposedSecretTypes: Object.freeze(allExposedTypes),
  });
}

export function secretIssueCount(result: Readonly<SecretsDetectionResult>): number {
  return result.issues.length;
}

export function criticalSecretIssues(
  result: Readonly<SecretsDetectionResult>,
): readonly SecurityIssue[] {
  return Object.freeze(result.issues.filter((i) => i.severity === "CRITICAL"));
}
