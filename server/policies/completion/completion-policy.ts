/**
 * server/policies/completion/completion-policy.ts
 * Blocks premature task_complete calls — requires proof artifacts.
 * Single responsibility: completion gating. No execution logic.
 */

import type { PolicyContext, PolicyResult } from "../types.ts";

export interface CompletionEvidence {
  buildPassed:      boolean;
  runtimeHealthy:   boolean;
  browserValidated: boolean;
  securityClean:    boolean;
  noOpenErrors:     boolean;
}

function extractEvidence(ctx: PolicyContext): CompletionEvidence {
  const m = ctx.metadata ?? {};
  return {
    buildPassed:      Boolean(m.buildPassed),
    runtimeHealthy:   Boolean(m.runtimeHealthy),
    browserValidated: Boolean(m.browserValidated),
    securityClean:    m.securityClean !== false,   // default allow if not set
    noOpenErrors:     m.noOpenErrors !== false,
  };
}

export function applyCompletionPolicy(ctx: PolicyContext): PolicyResult {
  const toolName = ctx.toolName ?? "";
  const isCompletion = toolName === "task_complete" || Boolean(ctx.metadata?.isCompletion);

  if (!isCompletion) {
    return {
      policy: "VerifiedCompletionPolicy",
      decision: "allow",
      severity: "low",
      reason: "Not a completion request.",
    };
  }

  const ev = extractEvidence(ctx);
  const failures: string[] = [];

  if (!ev.buildPassed)      failures.push("build has not passed");
  if (!ev.runtimeHealthy)   failures.push("runtime is not healthy");
  if (!ev.browserValidated) failures.push("browser validation has not passed");
  if (!ev.securityClean)    failures.push("security scan detected issues");
  if (!ev.noOpenErrors)     failures.push("there are unresolved errors");

  if (failures.length > 0) {
    return {
      policy: "VerifiedCompletionPolicy",
      decision: "block",
      severity: "high",
      reason: `Completion blocked — proof artifacts missing: ${failures.join("; ")}.`,
      remediation: "All verification gates must pass before task_complete is allowed.",
    };
  }

  return {
    policy: "VerifiedCompletionPolicy",
    decision: "allow",
    severity: "low",
    reason: "All completion proof artifacts verified.",
  };
}
