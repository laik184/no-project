/**
 * server/policies/validation/browser-validation-policy.ts
 * Blocks completion if browser validation detected critical issues.
 * Single responsibility: browser validation gating. No side effects.
 */

import type { PolicyContext, PolicyResult } from "../types.ts";

export function applyBrowserValidationPolicy(ctx: PolicyContext): PolicyResult {
  const toolName           = ctx.toolName;
  const browserBlocked     = ctx.metadata?.browserValidationBlocked as boolean | undefined;
  const blankScreen        = ctx.metadata?.blankScreen as boolean | undefined;
  const hydrationFailed    = ctx.metadata?.hydrationFailed as boolean | undefined;

  if (toolName !== "task_complete") {
    return { policy: "BrowserValidationPolicy", decision: "allow", severity: "low", reason: "Not a completion call." };
  }

  if (blankScreen) {
    return {
      policy:   "BrowserValidationPolicy",
      decision: "block",
      severity: "critical",
      reason:   "task_complete blocked — browser shows a blank screen.",
      remediation: "Fix the rendering issue before marking complete.",
    };
  }

  if (hydrationFailed) {
    return {
      policy:   "BrowserValidationPolicy",
      decision: "block",
      severity: "high",
      reason:   "task_complete blocked — hydration failure detected.",
      remediation: "Fix the hydration error (check server/client HTML mismatch).",
    };
  }

  if (browserBlocked) {
    return {
      policy:   "BrowserValidationPolicy",
      decision: "block",
      severity: "high",
      reason:   "task_complete blocked — browser validation did not pass.",
      remediation: "Fix all browser-detected issues before completing.",
    };
  }

  return { policy: "BrowserValidationPolicy", decision: "allow", severity: "low", reason: "Browser validation passed." };
}
