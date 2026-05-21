/**
 * server/policies/runtime/retry-policy.ts
 * Enforces retry caps and cooldowns to stop infinite loop scenarios.
 * Single responsibility: retry budget enforcement. No execution logic.
 */

import type { PolicyContext, PolicyResult } from "../types.ts";

const MAX_RETRIES_DEFAULT  = 5;
const MAX_RETRIES_CRITICAL = 3;
const COOLDOWN_THRESHOLD   = 3;   // retries before escalation

interface RetryConfig {
  maxRetries: number;
  cooldownMs: number;
}

const TOOL_RETRY_OVERRIDES: Record<string, RetryConfig> = {
  shell_execute:  { maxRetries: 3, cooldownMs: 2000 },
  npm_install:    { maxRetries: 2, cooldownMs: 5000 },
  build_project:  { maxRetries: 2, cooldownMs: 3000 },
  run_tests:      { maxRetries: 3, cooldownMs: 1000 },
};

function getConfig(toolName: string): RetryConfig {
  return TOOL_RETRY_OVERRIDES[toolName] ?? {
    maxRetries: MAX_RETRIES_DEFAULT,
    cooldownMs: 1000,
  };
}

export function applyRetryPolicy(ctx: PolicyContext): PolicyResult {
  const retryCount = ctx.retryCount ?? 0;
  const toolName   = ctx.toolName ?? "";
  const config     = getConfig(toolName);

  if (retryCount >= config.maxRetries) {
    return {
      policy: "MaxRetryPolicy",
      decision: "block",
      severity: retryCount >= MAX_RETRIES_CRITICAL ? "critical" : "high",
      reason: `Retry limit reached — ${retryCount}/${config.maxRetries} retries for "${toolName || "unknown"}".`,
      remediation: "Stop retrying. Escalate to reflection agent for root-cause analysis.",
    };
  }

  if (retryCount >= COOLDOWN_THRESHOLD) {
    return {
      policy: "MaxRetryPolicy",
      decision: "escalate",
      severity: "medium",
      reason: `High retry count (${retryCount}) for "${toolName}" — cooldown recommended.`,
      remediation: `Wait ${config.cooldownMs}ms before next retry.`,
    };
  }

  return {
    policy: "MaxRetryPolicy",
    decision: "allow",
    severity: "low",
    reason: `Retry ${retryCount}/${config.maxRetries} within budget.`,
  };
}
