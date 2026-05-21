/**
 * server/policies/execution/tool-usage-policy.ts
 * Enforces constraints on tool call frequency and sequencing.
 * Single responsibility: tool usage limits. No side effects.
 */

import type { PolicyContext, PolicyResult } from "../types.ts";

const HIGH_IMPACT_TOOLS = new Set([
  "run_command", "delete_file", "overwrite_file",
  "run_server", "install_package", "git_commit",
]);

const RATE_LIMITS: Record<string, number> = {
  run_command:     5,
  install_package: 3,
  delete_file:     10,
};

// In-memory call counter per runId (cleared on process restart)
const _callCounts = new Map<string, Map<string, number>>();

function getCount(runId: string, toolName: string): number {
  const byRun = _callCounts.get(runId);
  return byRun?.get(toolName) ?? 0;
}

export function incrementToolCount(runId: string, toolName: string): void {
  if (!_callCounts.has(runId)) _callCounts.set(runId, new Map());
  const map = _callCounts.get(runId)!;
  map.set(toolName, (map.get(toolName) ?? 0) + 1);
}

export function clearToolCounts(runId: string): void {
  _callCounts.delete(runId);
}

export function applyToolUsagePolicy(ctx: PolicyContext): PolicyResult {
  const toolName = ctx.toolName;
  if (!toolName) {
    return { policy: "ToolUsagePolicy", decision: "allow", severity: "low", reason: "No tool name." };
  }

  const callCount = getCount(ctx.runId, toolName);
  const rateLimit = RATE_LIMITS[toolName];

  if (rateLimit && callCount >= rateLimit) {
    return {
      policy:   "ToolUsagePolicy",
      decision: "escalate",
      severity: "medium",
      reason:   `Tool "${toolName}" called ${callCount} times — exceeds rate limit of ${rateLimit}.`,
      remediation: "Consider if this tool is being overused. Try a different approach.",
    };
  }

  if (HIGH_IMPACT_TOOLS.has(toolName)) {
    return {
      policy:   "ToolUsagePolicy",
      decision: "allow",     // allow but flag
      severity: "medium",
      reason:   `High-impact tool "${toolName}" — proceed with caution.`,
    };
  }

  return { policy: "ToolUsagePolicy", decision: "allow", severity: "low", reason: "Tool usage is within limits." };
}
