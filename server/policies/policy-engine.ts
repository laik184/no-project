/**
 * server/policies/policy-engine.ts
 * Evaluates all applicable policies for a given context.
 * Produces a PolicyReport — BLOCKS take precedence over ESCALATES.
 * Single responsibility: policy orchestration. No business logic.
 */

import { applyMaxRetryPolicy }            from "./runtime/max-retry-policy.ts";
import { applyRuntimeHealthPolicy }       from "./runtime/runtime-health-policy.ts";
import { applySafeFilesystemPolicy }      from "./filesystem/safe-filesystem-policy.ts";
import { applySafeExecutionPolicy }       from "./execution/safe-execution-policy.ts";
import { applyToolUsagePolicy }           from "./execution/tool-usage-policy.ts";
import { applyVerifiedCompletionPolicy }  from "./validation/verified-completion-policy.ts";
import { applyDependencyTrustPolicy }     from "./validation/dependency-trust-policy.ts";
import { applyBrowserValidationPolicy }   from "./validation/browser-validation-policy.ts";
import { bus }                            from "../infrastructure/events/bus.ts";
import type { PolicyContext, PolicyReport, PolicyDecision } from "./types.ts";

// ── Policy registry ───────────────────────────────────────────────────────────

type PolicyFn = (ctx: PolicyContext) => PolicyResult | Promise<PolicyResult>;
type PolicyResult = import("./types.ts").PolicyResult;

const POLICIES: PolicyFn[] = [
  applyMaxRetryPolicy,
  applyRuntimeHealthPolicy,
  applySafeFilesystemPolicy,
  applySafeExecutionPolicy,
  applyToolUsagePolicy,
  applyVerifiedCompletionPolicy,
  applyDependencyTrustPolicy,
  applyBrowserValidationPolicy,
];

// ── Public API ────────────────────────────────────────────────────────────────

export async function runPolicyEngine(
  ctx: PolicyContext,
): Promise<PolicyReport> {
  const startTs = Date.now();
  const results = await Promise.all(POLICIES.map(p => Promise.resolve(p(ctx))));

  const blocked      = results.filter(r => r.decision === "block");
  const escalated    = results.filter(r => r.decision === "escalate");
  const blockReasons = blocked.map(r => r.reason);

  const finalDecision: PolicyDecision =
    blocked.length > 0    ? "block"   :
    escalated.length > 0  ? "escalate" :
    "allow";

  const report: PolicyReport = {
    runId:     ctx.runId,
    projectId: ctx.projectId,
    context:   ctx,
    results,
    finalDecision,
    blocked:      finalDecision === "block",
    blockReasons,
    elapsedMs: Date.now() - startTs,
  };

  if (finalDecision !== "allow") {
    bus.emit("agent.event", {
      runId:     ctx.runId,
      eventType: "policy.blocked" as any,
      phase:     "tool-loop",
      ts:        Date.now(),
      payload:   { decision: finalDecision, blockReasons, policies: blocked.map(r => r.policy) },
    });
  }

  return report;
}
