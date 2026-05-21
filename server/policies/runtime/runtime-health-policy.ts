/**
 * server/policies/runtime/runtime-health-policy.ts
 * Blocks completion if no healthy runtime process is detected for the project.
 * Single responsibility: runtime health enforcement. No side effects.
 */

import { runtimeManager }       from "../../infrastructure/runtime/runtime-manager.ts";
import type { PolicyContext, PolicyResult } from "../types.ts";

export function applyRuntimeHealthPolicy(ctx: PolicyContext): PolicyResult {
  try {
    const processes = runtimeManager.getProcesses(ctx.projectId);
    const alive     = processes?.filter(p => p.status === "running") ?? [];

    if (alive.length === 0) {
      return {
        policy:   "RuntimeHealthPolicy",
        decision: "escalate",
        severity: "high",
        reason:   "No healthy runtime process detected. Dev server may be down.",
        remediation: "Use run_server tool to start the dev server before marking complete.",
      };
    }

    return {
      policy:   "RuntimeHealthPolicy",
      decision: "allow",
      severity: "low",
      reason:   `${alive.length} runtime process(es) healthy.`,
    };
  } catch {
    return {
      policy:   "RuntimeHealthPolicy",
      decision: "allow",       // non-blocking — runtime manager may be unavailable
      severity: "low",
      reason:   "Runtime manager unavailable — skipping health check.",
    };
  }
}
