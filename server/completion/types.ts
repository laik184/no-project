/**
 * server/completion/types.ts
 * Shared types for the completion gate system.
 * No logic, no imports from sibling modules.
 */

export type CompletionCheckName =
  | "BuildValidation"
  | "RuntimeHealth"
  | "BrowserValidation"
  | "DependencyValidation"
  | "SecurityValidation"
  | "FinalReconciliation";

export type CompletionStatus = "pending" | "passed" | "failed" | "skipped";

export interface CompletionCheckResult {
  check:   CompletionCheckName;
  status:  CompletionStatus;
  passed:  boolean;
  details: string;
  evidence?: Record<string, unknown>;
}

export interface CompletionGateInput {
  runId:       string;
  projectId:   number;
  projectRoot: string;
  devPort?:    number;
  previewUrl?: string;
}

export interface CompletionGateOutput {
  passed:               boolean;
  failedChecks:         CompletionCheckResult[];
  passedChecks:         CompletionCheckResult[];
  runtimeStatus:        string;
  browserStatus:        string;
  securityStatus:       string;
  reconciliationSummary: string;
  elapsedMs:            number;
}

export interface ReconciliationState {
  filesWritten:    number;
  buildArtifacts:  string[];
  runtimeHealthy:  boolean;
  browserPassed:   boolean;
  noCriticalErrors: boolean;
}
