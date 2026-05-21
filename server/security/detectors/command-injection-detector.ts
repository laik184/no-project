/**
 * server/security/detectors/command-injection-detector.ts
 * Detects patterns that allow shell command injection in generated code.
 * Single responsibility: injection detection. Read-only, no side effects.
 */

import type { SecurityFinding } from "./types.ts";

const INJECTION_PATTERNS: Array<{ re: RegExp; label: string; severity: SecurityFinding["severity"] }> = [
  { re: /exec\s*\(`[^`]*\${/g,        label: "Template literal in exec()",     severity: "critical" },
  { re: /execSync\s*\(`[^`]*\${/g,    label: "Template literal in execSync()", severity: "critical" },
  { re: /spawn\s*\([^,]+,\s*\[.*\${/g, label: "Variable in spawn args",        severity: "high" },
  { re: /child_process.*\$\{req\./g,   label: "Request data in shell command",  severity: "critical" },
  { re: /shell:\s*true/g,              label: "shell:true in spawn options",    severity: "high" },
  { re: /exec\s*\([^)]*req\./g,        label: "Request data in exec()",         severity: "critical" },
];

export function detectCommandInjection(code: string, filePath: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  for (const { re, label, severity } of INJECTION_PATTERNS) {
    if (re.test(code)) {
      findings.push({
        threat:      "command_injection",
        severity,
        evidence:    `Command injection risk: ${label}`,
        location:    filePath,
        remediation: "Never interpolate user input into shell commands. Use parameterized arguments with spawn().",
        blocked:     severity === "critical",
      });
    }
  }

  return findings;
}
