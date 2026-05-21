/**
 * server/security/detectors/path-traversal-detector.ts
 * Detects path traversal vulnerabilities in generated code.
 * Single responsibility: path traversal detection. Read-only, no side effects.
 */

import type { SecurityFinding } from "./types.ts";

const TRAVERSAL_PATTERNS: Array<{ re: RegExp; label: string; severity: SecurityFinding["severity"] }> = [
  { re: /path\.join\s*\([^)]*req\.[^)]*\)/g,      label: "path.join with request data",      severity: "high" },
  { re: /readFile\s*\([^)]*req\.[^)]*\)/g,         label: "readFile with request data",        severity: "critical" },
  { re: /readFileSync\s*\([^)]*req\.[^)]*\)/g,     label: "readFileSync with request data",    severity: "critical" },
  { re: /\.\.[\/\\].*\$\{req\./g,                  label: "Directory traversal in template",   severity: "critical" },
  { re: /path\.resolve\s*\([^)]*req\.[^)]*\)/g,    label: "path.resolve with request data",   severity: "high" },
  { re: /fs\.\w+\s*\([^)]*\.\.[\/\\]/g,            label: "Hardcoded relative path in fs call", severity: "medium" },
];

export function detectPathTraversal(code: string, filePath: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  for (const { re, label, severity } of TRAVERSAL_PATTERNS) {
    if (re.test(code)) {
      findings.push({
        threat:      "path_traversal",
        severity,
        evidence:    `Path traversal risk: ${label}`,
        location:    filePath,
        remediation: "Use path.resolve() with a sandbox root check. Never use user input directly in file paths.",
        blocked:     severity === "critical",
      });
    }
  }

  return findings;
}
