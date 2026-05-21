/**
 * server/security/detectors/dangerous-dependency-detector.ts
 * Detects imports of known-dangerous or deprecated packages.
 * Single responsibility: dangerous dep detection. Read-only, no side effects.
 */

import type { SecurityFinding } from "./types.ts";

const DANGEROUS_PACKAGES = new Map<string, { reason: string; severity: SecurityFinding["severity"] }>([
  ["eval",           { reason: "exec-as-string library",           severity: "critical" }],
  ["serialize-javascript", { reason: "XSS risk when used incorrectly", severity: "medium" }],
  ["node-serialize", { reason: "Known RCE vulnerability (CVE-2017-5941)", severity: "critical" }],
  ["mathjs",         { reason: "eval() used internally",            severity: "medium" }],
  ["vm2",            { reason: "Multiple sandbox escape CVEs",      severity: "high" }],
  ["shelljs",        { reason: "Command injection risk",            severity: "high" }],
  ["request",        { reason: "Deprecated, use node-fetch or axios", severity: "low" }],
]);

const IMPORT_RE = /(?:require|import)\s*\(?['"`]([^'"`]+)['"`]\)?/g;

export function detectDangerousDependency(code: string, filePath: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  for (const match of code.matchAll(IMPORT_RE)) {
    const pkg = match[1]!.split("/")[0]!;
    const info = DANGEROUS_PACKAGES.get(pkg);
    if (info) {
      findings.push({
        threat:      "dangerous_dependency",
        severity:    info.severity,
        evidence:    `Dangerous package imported: "${pkg}" — ${info.reason}`,
        location:    filePath,
        remediation: `Avoid using "${pkg}". Use a safer alternative.`,
        blocked:     info.severity === "critical",
      });
    }
  }

  return findings;
}
