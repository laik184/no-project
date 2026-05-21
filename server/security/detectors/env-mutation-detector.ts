/**
 * server/security/detectors/env-mutation-detector.ts
 * Detects dangerous mutation of process.env and .env file exposure.
 * Single responsibility: env mutation detection. Read-only, no side effects.
 */

import type { SecurityFinding } from "./types.ts";

const ENV_PATTERNS: Array<{ re: RegExp; label: string; severity: SecurityFinding["severity"] }> = [
  { re: /process\.env\s*\[\s*[^"']+\]\s*=/g,     label: "Dynamic env variable mutation",      severity: "high" },
  { re: /process\.env\.\w+\s*=/g,                 label: "Direct env mutation",               severity: "medium" },
  { re: /JSON\.stringify\s*\(\s*process\.env\s*\)/g, label: "Serializing all env vars",       severity: "critical" },
  { re: /res\.(?:json|send)\s*\([^)]*process\.env/g, label: "Sending env vars in response",  severity: "critical" },
  { re: /console\.log\s*\([^)]*process\.env/g,    label: "Logging env vars",                 severity: "high" },
  { re: /require\s*\(['"]dotenv['"]\)\.config\s*\(\)/g, label: "dotenv.config() at runtime", severity: "low" },
];

export function detectEnvMutation(code: string, filePath: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  for (const { re, label, severity } of ENV_PATTERNS) {
    if (re.test(code)) {
      findings.push({
        threat:      "env_mutation",
        severity,
        evidence:    `Environment variable risk: ${label}`,
        location:    filePath,
        remediation: "Never expose or mutate process.env at runtime. Load secrets once at startup via config.",
        blocked:     severity === "critical",
      });
    }
  }

  return findings;
}
