/**
 * server/engines/reflection/recovery-recommender.ts
 * Recommends a recovery strategy based on failure analysis and retry loops.
 * Single responsibility: recommend → RecoveryRecommendation. No side effects.
 */

import type { FailureAnalysis, RetryLoopReport, RecoveryRecommendation } from "./types.ts";

// ── Strategy selection ────────────────────────────────────────────────────────

export function recommendRecovery(
  analysis: FailureAnalysis,
  loop:     RetryLoopReport,
): RecoveryRecommendation {

  // Loop detected → must change approach first
  if (loop.detected) {
    return {
      strategy: "change_approach",
      actions: [
        `Stop repeating "${loop.repeatedTool}" (called ${loop.count} times with same args).`,
        "Try an alternative tool or a different argument pattern.",
        "If stuck, use rollback to restore last known good state.",
      ],
      priority: "immediate",
    };
  }

  const types = analysis.failureTypes;

  if (types.includes("runtime_crash")) {
    return {
      strategy: "restart_runtime",
      actions: [
        "Check runtime logs for the crash cause.",
        "Fix the crash-inducing code before restarting.",
        "Use run_server tool to restart the process after fix.",
      ],
      priority: "immediate",
    };
  }

  if (types.includes("missing_dependency")) {
    return {
      strategy: "install_deps",
      actions: [
        "Run npm install for any missing packages.",
        "Verify package.json lists all required dependencies.",
        "Check for typos in import paths.",
      ],
      priority: "immediate",
    };
  }

  if (types.includes("typescript_error")) {
    return {
      strategy: "fix_imports",
      actions: [
        "Read the TypeScript error output carefully.",
        "Fix type mismatches, missing exports, or wrong import paths.",
        "Run tsc --noEmit after fixes to confirm clean.",
      ],
      priority: "immediate",
    };
  }

  if (types.includes("missing_file")) {
    return {
      strategy: "fix_imports",
      actions: [
        "Verify the referenced file path exists.",
        "Create the missing file or correct the import path.",
      ],
      priority: "next_step",
    };
  }

  if (types.includes("preview_unreachable")) {
    return {
      strategy: "restart_runtime",
      actions: [
        "Confirm the dev server is running and listening on the expected port.",
        "Check for startup errors in runtime logs.",
      ],
      priority: "next_step",
    };
  }

  if (analysis.failureTypes.length === 0) {
    return { strategy: "none", actions: [], priority: "optional" };
  }

  return {
    strategy: "change_approach",
    actions: [
      "Review failure details and take a different approach.",
      "Consider rolling back to the last checkpoint if progress is blocked.",
    ],
    priority: "next_step",
  };
}
