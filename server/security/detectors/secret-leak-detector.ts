/**
 * server/security/detectors/secret-leak-detector.ts
 * Detects hardcoded secrets, API keys, and tokens in generated code.
 * Single responsibility: secret detection. Read-only, no side effects.
 */

import type { SecurityFinding } from "./types.ts";

const SECRET_PATTERNS: Array<{ re: RegExp; label: string; severity: SecurityFinding["severity"] }> = [
  { re: /(?:api[_-]?key|apikey)\s*[:=]\s*["'][a-z0-9_\-]{16,}["']/gi,      label: "API key",         severity: "critical" },
  { re: /(?:secret|password|passwd|pwd)\s*[:=]\s*["'][^"']{6,}["']/gi,      label: "Hardcoded secret", severity: "critical" },
  { re: /bearer\s+[a-z0-9_\-\.]{20,}/gi,                                    label: "Bearer token",    severity: "critical" },
  { re: /sk-[a-z0-9]{32,}/gi,                                               label: "OpenAI key",      severity: "critical" },
  { re: /ghp_[a-z0-9]{36}/gi,                                               label: "GitHub token",    severity: "critical" },
  { re: /-----BEGIN (?:RSA|EC|OPENSSH) PRIVATE KEY-----/,                   label: "Private key",     severity: "critical" },
  { re: /(?:access_token|auth_token)\s*[:=]\s*["'][a-z0-9_\-\.]{20,}["']/gi, label: "Access token",  severity: "high" },
  { re: /process\.env\s*\.\s*\w+\s*\|\|\s*["'][a-z0-9]{8,}["']/gi,         label: "Env fallback",   severity: "medium" },
];

export function detectSecretLeaks(code: string, filePath: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  for (const { re, label, severity } of SECRET_PATTERNS) {
    const matches = code.matchAll(re);
    for (const match of matches) {
      const snippet = match[0].slice(0, 60);
      findings.push({
        threat:      "secret_leak",
        severity,
        evidence:    `${label} pattern found: "${snippet}..."`,
        location:    filePath,
        remediation: "Use process.env.SECRET_NAME instead of hardcoding secrets. Add to .env file.",
        blocked:     severity === "critical",
      });
    }
  }

  return findings;
}
