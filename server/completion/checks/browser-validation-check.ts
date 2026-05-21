/**
 * server/completion/checks/browser-validation-check.ts
 * Delegates to the browser validator and wraps result as a completion check.
 * Single responsibility: bridge browser report → completion result.
 */

import { runBrowserValidation }     from "../../browser/browser-validator.ts";
import type { CompletionCheckResult, CompletionGateInput } from "../types.ts";

export async function runBrowserValidationCheck(
  input: CompletionGateInput,
): Promise<CompletionCheckResult> {
  let report;
  try {
    report = await runBrowserValidation(input.projectId, input.runId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      check:   "BrowserValidation",
      status:  "failed",
      passed:  false,
      details: `Browser validation threw an error: ${msg}`,
    };
  }

  const passed = !report.blocked && report.visualStatus !== "blank";

  return {
    check:    "BrowserValidation",
    status:   passed ? "passed" : "failed",
    passed,
    details:  passed
      ? `Browser validation passed — visual: ${report.visualStatus}, hydration: ${report.hydrationStatus}.`
      : `Browser validation failed: ${report.blockReasons.join("; ")}`,
    evidence: {
      visualStatus:    report.visualStatus,
      hydrationStatus: report.hydrationStatus,
      consoleErrors:   report.consoleErrors.length,
      screenshot:      report.screenshotEvidence ? "present" : "none",
    },
  };
}
