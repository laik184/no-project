/**
 * server/policies/validation/dependency-trust-policy.ts
 * Validates that packages being installed are not known-malicious.
 * Single responsibility: dependency trust enforcement. No side effects.
 */

import type { PolicyContext, PolicyResult } from "../types.ts";

// Known typosquatting / malicious package name patterns
const BLOCKED_PACKAGES = new Set([
  "crossenv", "cross-env.js", "node-opencv", "nodecookies",
  "socketio", "cofeescript", "mongose", "babelcli",
]);

const SUSPICIOUS_PATTERNS = [
  /^[a-z]+-[a-z]+-[a-z]+-[a-z]+$/,  // excessive dashes (typosquatting pattern)
  /0x[a-f0-9]{6}/,                    // hex-encoded names
];

export function applyDependencyTrustPolicy(ctx: PolicyContext): PolicyResult {
  const pkg = ctx.packageName ?? ctx.metadata?.packageName as string ?? "";

  if (!pkg) {
    return { policy: "DependencyTrustPolicy", decision: "allow", severity: "low", reason: "No package name." };
  }

  if (BLOCKED_PACKAGES.has(pkg.toLowerCase())) {
    return {
      policy:   "DependencyTrustPolicy",
      decision: "block",
      severity: "critical",
      reason:   `Package "${pkg}" is in the known-malicious blocklist.`,
      remediation: "Do not install this package. Use the correct package name.",
    };
  }

  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(pkg)) {
      return {
        policy:   "DependencyTrustPolicy",
        decision: "escalate",
        severity: "medium",
        reason:   `Package name "${pkg}" matches a suspicious typosquatting pattern.`,
        remediation: "Verify the package name is correct before installing.",
      };
    }
  }

  return { policy: "DependencyTrustPolicy", decision: "allow", severity: "low", reason: `Package "${pkg}" appears safe.` };
}
