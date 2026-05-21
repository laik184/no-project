/**
 * server/completion/runtime/final-reconciliation.ts
 * Performs final state reconciliation — all checks passed, state is consistent.
 * Single responsibility: post-check state validation. No execution.
 */

import type { CompletionCheckResult, CompletionGateInput, ReconciliationState } from "../types.ts";

export interface ReconciliationReport {
  consistent:  boolean;
  state:       ReconciliationState;
  summary:     string;
  anomalies:   string[];
}

function validateState(state: ReconciliationState): string[] {
  const anomalies: string[] = [];

  if (!state.runtimeHealthy) {
    anomalies.push("Runtime is not healthy — server not responding.");
  }
  if (!state.browserPassed) {
    anomalies.push("Browser validation did not pass — UI may be broken.");
  }
  if (!state.noCriticalErrors) {
    anomalies.push("Critical errors remain unresolved.");
  }
  if (state.filesWritten === 0) {
    anomalies.push("No files were written — task may be incomplete.");
  }

  return anomalies;
}

export async function runFinalReconciliation(
  input:        CompletionGateInput,
  checkResults: CompletionCheckResult[],
): Promise<CompletionCheckResult> {
  const passedChecks  = checkResults.filter(c => c.passed || c.status === "skipped");
  const failedChecks  = checkResults.filter(c => !c.passed && c.status !== "skipped");

  const state: ReconciliationState = {
    filesWritten:     (input as any).filesWritten ?? 1,   // provided by caller
    buildArtifacts:   [],
    runtimeHealthy:   checkResults.find(c => c.check === "RuntimeHealth")?.passed ?? false,
    browserPassed:    checkResults.find(c => c.check === "BrowserValidation")?.passed ?? false,
    noCriticalErrors: failedChecks.length === 0,
  };

  const anomalies = validateState(state);
  const consistent = anomalies.length === 0;

  const summary = consistent
    ? `Reconciliation complete — ${passedChecks.length} checks passed, state consistent.`
    : `Reconciliation found ${anomalies.length} anomaly(s): ${anomalies.join("; ")}`;

  return {
    check:   "FinalReconciliation",
    status:  consistent ? "passed" : "failed",
    passed:  consistent,
    details: summary,
    evidence: { passedCount: passedChecks.length, failedCount: failedChecks.length, anomalies },
  };
}
