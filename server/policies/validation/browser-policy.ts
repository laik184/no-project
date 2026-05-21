/**
 * server/policies/validation/browser-policy.ts
 * Requires visual browser validation before completion is allowed.
 * Single responsibility: browser evidence enforcement. No browser logic.
 */

import type { PolicyContext, PolicyResult } from "../types.ts";
import type { BrowserValidationReport }     from "../../browser/types.ts";

function extractBrowserReport(ctx: PolicyContext): BrowserValidationReport | null {
  return (ctx.metadata?.browserReport as BrowserValidationReport) ?? null;
}

export function applyBrowserPolicy(ctx: PolicyContext): PolicyResult {
  const toolName    = ctx.toolName ?? "";
  const isCompletion = toolName === "task_complete" || Boolean(ctx.metadata?.isCompletion);

  if (!isCompletion) {
    return {
      policy: "BrowserValidationPolicy",
      decision: "allow",
      severity: "low",
      reason: "Browser policy only applies at completion boundary.",
    };
  }

  const report = extractBrowserReport(ctx);

  if (!report) {
    return {
      policy: "BrowserValidationPolicy",
      decision: "escalate",
      severity: "medium",
      reason: "No browser validation report found — completion unverified visually.",
      remediation: "Run browser validation before calling task_complete.",
    };
  }

  if (report.blocked) {
    return {
      policy: "BrowserValidationPolicy",
      decision: "block",
      severity: "high",
      reason: `Browser validation failed: ${report.blockReasons.join("; ")}.`,
      remediation: "Fix the UI issues reported by the browser agent before completing.",
    };
  }

  if (report.visualStatus === "blank") {
    return {
      policy: "BrowserValidationPolicy",
      decision: "block",
      severity: "critical",
      reason: "Browser shows a blank screen — app is not rendering.",
      remediation: "Fix rendering errors. Check console for hydration failures.",
    };
  }

  if (report.hydrationStatus === "failed") {
    return {
      policy: "BrowserValidationPolicy",
      decision: "block",
      severity: "high",
      reason: "React/Vue hydration failure detected in browser.",
      remediation: "Resolve SSR/client mismatch before marking complete.",
    };
  }

  return {
    policy: "BrowserValidationPolicy",
    decision: "allow",
    severity: "low",
    reason: "Browser validation passed with no blocking issues.",
  };
}
