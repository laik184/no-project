/**
 * server/policies/validation/verified-completion-policy.ts
 * Blocks task_complete unless verification has passed.
 * Single responsibility: completion gating. No side effects.
 */

import type { PolicyContext, PolicyResult } from "../types.ts";

export function applyVerifiedCompletionPolicy(ctx: PolicyContext): PolicyResult {
  const toolName = ctx.toolName;

  if (toolName !== "task_complete") {
    return { policy: "VerifiedCompletionPolicy", decision: "allow", severity: "low", reason: "Not a completion call." };
  }

  const verificationPassed = ctx.metadata?.verificationPassed as boolean | undefined;
  const stepCount           = ctx.metadata?.stepCount as number | undefined ?? 0;

  if (verificationPassed === false) {
    return {
      policy:   "VerifiedCompletionPolicy",
      decision: "block",
      severity: "high",
      reason:   "task_complete blocked — last verification run did not pass.",
      remediation: "Fix all verification failures before calling task_complete.",
    };
  }

  if (stepCount < 2) {
    return {
      policy:   "VerifiedCompletionPolicy",
      decision: "block",
      severity: "high",
      reason:   `task_complete blocked — only ${stepCount} step(s) taken. Premature completion detected.`,
      remediation: "Complete more meaningful work before marking task done.",
    };
  }

  return {
    policy:   "VerifiedCompletionPolicy",
    decision: "allow",
    severity: "low",
    reason:   "Completion verified — verification passed and sufficient steps taken.",
  };
}
