/**
 * server/policies/runtime/max-retry-policy.ts
 * Blocks execution when retry count exceeds the configured maximum.
 * Single responsibility: enforce retry limits. No side effects.
 */

import type { PolicyContext, PolicyResult } from "../types.ts";

const DEFAULT_MAX_RETRIES = 5;

export function applyMaxRetryPolicy(ctx: PolicyContext): PolicyResult {
  const retries = ctx.retryCount ?? 0;
  const max     = (ctx.metadata?.maxRetries as number | undefined) ?? DEFAULT_MAX_RETRIES;

  if (retries >= max) {
    return {
      policy:   "MaxRetryPolicy",
      decision: "block",
      severity: "high",
      reason:   `Retry limit reached: ${retries}/${max}. Agent is stuck in a failure loop.`,
      remediation: "Trigger reflection engine, change strategy, or escalate to user.",
    };
  }

  return {
    policy:   "MaxRetryPolicy",
    decision: "allow",
    severity: "low",
    reason:   `Retries within limit: ${retries}/${max}`,
  };
}
