/**
 * server/security/detectors/ssrf-detector.ts
 * Detects Server-Side Request Forgery patterns in generated code.
 * Single responsibility: SSRF detection. Read-only, no side effects.
 */

import type { SecurityFinding } from "./types.ts";

const SSRF_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /fetch\s*\(\s*req\./g,               label: "fetch() with request-derived URL" },
  { re: /axios\.\w+\s*\(\s*req\./g,          label: "axios with request-derived URL" },
  { re: /http\.get\s*\(\s*req\./g,           label: "http.get with request-derived URL" },
  { re: /new\s+URL\s*\(\s*req\./g,           label: "URL constructor with request data" },
  { re: /fetch\s*\(\s*`[^`]*\${req\./g,      label: "Template URL from request" },
  { re: /http\s*:\/\/localhost.{0,20}\$\{/g, label: "Dynamic localhost URL" },
  { re: /http\s*:\/\/127\.0\.0\.1.{0,20}\$\{/g, label: "Dynamic loopback URL" },
];

export function detectSSRF(code: string, filePath: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  for (const { re, label } of SSRF_PATTERNS) {
    if (re.test(code)) {
      findings.push({
        threat:      "ssrf",
        severity:    "high",
        evidence:    `SSRF pattern detected: ${label}`,
        location:    filePath,
        remediation: "Validate and allowlist URLs before making server-side requests. Never use user-controlled URLs directly.",
        blocked:     true,
      });
    }
  }

  return findings;
}
