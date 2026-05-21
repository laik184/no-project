/**
 * server/policies/security/dependency-policy.ts
 * Validates package trustworthiness before installation.
 * Single responsibility: dependency risk assessment. No execution.
 */

import type { PolicyContext, PolicyResult } from "../types.ts";

const BLOCKED_PACKAGES: Set<string> = new Set([
  "node-pre-gyp-fix", "event-stream",       // known supply-chain attack vectors
  "flatmap-stream", "cross-env-safe",
  "eslint-config-standard-with-typescript",  // typosquat examples
]);

const SUSPICIOUS_PATTERNS: RegExp[] = [
  /^[a-z]{1,3}$/,          // single/double char names — often malicious
  /preinstall.*curl/,
  /postinstall.*wget/,
  /-{3,}/,                  // triple dashes — typosquatting signal
];

const HIGH_RISK_SCOPES: string[] = ["@npm/", "@node/"];

function extractPackageName(ctx: PolicyContext): string {
  return ctx.packageName
    ?? (ctx.metadata?.packageName as string)
    ?? (ctx.command?.match(/(?:npm|yarn|pnpm)\s+(?:i|install|add)\s+([\w@/.-]+)/)?.[1])
    ?? "";
}

export function applyDependencyPolicy(ctx: PolicyContext): PolicyResult {
  const pkg = extractPackageName(ctx);

  if (!pkg) {
    return {
      policy: "DependencyTrustPolicy",
      decision: "allow",
      severity: "low",
      reason: "No package name in context.",
    };
  }

  const baseName = pkg.replace(/^@[^/]+\//, "").split("@")[0];

  if (BLOCKED_PACKAGES.has(baseName) || BLOCKED_PACKAGES.has(pkg)) {
    return {
      policy: "DependencyTrustPolicy",
      decision: "block",
      severity: "critical",
      reason: `Package "${pkg}" is on the blocked list (known malicious or supply-chain risk).`,
      remediation: "Do not install this package. Find a vetted alternative.",
    };
  }

  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(baseName)) {
      return {
        policy: "DependencyTrustPolicy",
        decision: "escalate",
        severity: "high",
        reason: `Package name "${pkg}" matches a suspicious pattern — possible typosquat.`,
        remediation: "Verify package authenticity on npmjs.com before installing.",
      };
    }
  }

  if (HIGH_RISK_SCOPES.some(s => pkg.startsWith(s))) {
    return {
      policy: "DependencyTrustPolicy",
      decision: "escalate",
      severity: "medium",
      reason: `Package scope "${pkg}" is high-risk.`,
      remediation: "Confirm scope legitimacy before installing.",
    };
  }

  return {
    policy: "DependencyTrustPolicy",
    decision: "allow",
    severity: "low",
    reason: `Package "${pkg}" passed dependency trust checks.`,
  };
}
