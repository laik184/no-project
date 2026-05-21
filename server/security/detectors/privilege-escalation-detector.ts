/**
 * server/security/detectors/privilege-escalation-detector.ts
 * Detects privilege escalation patterns in generated code.
 * Single responsibility: privilege escalation detection. Read-only.
 */

import type { SecurityFinding } from "./types.ts";

const PRIVILEGE_PATTERNS: Array<{ re: RegExp; label: string; severity: SecurityFinding["severity"] }> = [
  { re: /process\.setuid\s*\(/g,              label: "process.setuid()",         severity: "critical" },
  { re: /process\.setgid\s*\(/g,              label: "process.setgid()",         severity: "critical" },
  { re: /exec\s*\(['"`]sudo/g,               label: "sudo in exec()",           severity: "critical" },
  { re: /chmod\s+(?:777|a\+rwx|0777)/g,      label: "World-writable chmod",     severity: "high" },
  { re: /chown\s+root/g,                      label: "chown to root",            severity: "high" },
  { re: /runAsRoot|as_root|withSudo/g,       label: "Root execution helper",    severity: "high" },
  { re: /capabilities\s*:\s*\[\s*["']ALL["']/g, label: "All capabilities",      severity: "critical" },
  { re: /privileged\s*:\s*true/g,            label: "Privileged container mode", severity: "critical" },
];

export function detectPrivilegeEscalation(code: string, filePath: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  for (const { re, label, severity } of PRIVILEGE_PATTERNS) {
    if (re.test(code)) {
      findings.push({
        threat:      "privilege_escalation",
        severity,
        evidence:    `Privilege escalation: ${label}`,
        location:    filePath,
        remediation: "Never run application code as root. Drop privileges, use least-privilege service accounts.",
        blocked:     severity === "critical",
      });
    }
  }

  return findings;
}
