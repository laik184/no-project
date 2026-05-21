/**
 * server/fail-closed/audit/failure-classifier.ts
 *
 * FailureClassifier — maps raw stage failures to structured ClassifiedFailure.
 * Determines: class, retryability, recoverability, suggested action.
 * No I/O. No state. Pure classification logic.
 *
 * INVARIANT: Unknown failures are classified as non-retryable (fail-closed default).
 */

import type {
  StageResult,
  ClassifiedFailure,
  FailureClass,
  VerificationStage,
  Evidence,
} from "../contracts/types.ts";

export class FailureClassifier {

  classify(result: StageResult): ClassifiedFailure {
    const reason = result.failureReason ?? "";
    const stage  = result.stage;

    switch (stage) {
      case "STATIC":              return this._classifyStatic(reason, result.evidence);
      case "BUILD":               return this._classifyBuild(reason, result.evidence);
      case "RUNTIME":             return this._classifyRuntime(reason, result.evidence);
      case "PREVIEW":             return this._classifyPreview(reason, result.evidence);
      case "STATE_RECONCILIATION":return this._classifyState(reason);
      default:                    return this._unknown(stage, reason);
    }
  }

  private _classifyStatic(reason: string, evidence: readonly Evidence[]): ClassifiedFailure {
    const hasCircular = reason.toLowerCase().includes("circular");
    const hasImport   = reason.toLowerCase().includes("import") || reason.toLowerCase().includes("missing export");

    if (hasCircular) return {
      class: "CIRCULAR_DEP_FAILURE", stage: "STATIC", detail: reason,
      retryable: false, recoverable: false,
      suggestedAction: "Fix circular dependency before retrying",
    };
    if (hasImport) return {
      class: "STATIC_ANALYSIS_FAILURE", stage: "STATIC", detail: reason,
      retryable: false, recoverable: false,
      suggestedAction: "Fix broken imports or missing exports",
    };
    return {
      class: "STATIC_ANALYSIS_FAILURE", stage: "STATIC", detail: reason,
      retryable: false, recoverable: false,
      suggestedAction: "Review static analysis errors",
    };
  }

  private _classifyBuild(reason: string, evidence: readonly Evidence[]): ClassifiedFailure {
    const isTs   = reason.toLowerCase().includes("typescript") || reason.toLowerCase().includes("tsc");
    const isDeps = reason.toLowerCase().includes("missing") || reason.toLowerCase().includes("package");
    const isTimeout = reason.toLowerCase().includes("timeout");

    if (isTs) return {
      class: "TYPESCRIPT_FAILURE", stage: "BUILD", detail: reason,
      retryable: false, recoverable: false,
      suggestedAction: "Fix TypeScript errors reported by tsc --noEmit",
    };
    if (isDeps) return {
      class: "DEPENDENCY_FAILURE", stage: "BUILD", detail: reason,
      retryable: true, recoverable: true,
      suggestedAction: "Run npm install to restore missing dependencies",
    };
    if (isTimeout) return {
      class: "VERIFICATION_TIMEOUT", stage: "BUILD", detail: reason,
      retryable: true, recoverable: false,
      suggestedAction: "Investigate slow build; consider tsconfig optimization",
    };
    return {
      class: "BUILD_FAILURE", stage: "BUILD", detail: reason,
      retryable: false, recoverable: false,
      suggestedAction: "Review build errors",
    };
  }

  private _classifyRuntime(reason: string, _evidence: readonly Evidence[]): ClassifiedFailure {
    const isCrash   = reason.toLowerCase().includes("crash") || reason.toLowerCase().includes("crash loop");
    const isProcess = reason.toLowerCase().includes("pid") || reason.toLowerCase().includes("not alive");
    const isPort    = reason.toLowerCase().includes("port") || reason.toLowerCase().includes("unreachable");
    const isHttp    = reason.toLowerCase().includes("http") || reason.toLowerCase().includes("200");

    if (isCrash) return {
      class: "CRASH_LOOP", stage: "RUNTIME", detail: reason,
      retryable: false, recoverable: true,
      suggestedAction: "Investigate crash logs and fix startup error",
    };
    if (isProcess) return {
      class: "PROCESS_FAILURE", stage: "RUNTIME", detail: reason,
      retryable: true, recoverable: true,
      suggestedAction: "Restart the process and verify it stays alive",
    };
    if (isPort || isHttp) return {
      class: "HTTP_FAILURE", stage: "RUNTIME", detail: reason,
      retryable: true, recoverable: true,
      suggestedAction: "Wait for port to open; check server startup sequence",
    };
    return {
      class: "PROCESS_FAILURE", stage: "RUNTIME", detail: reason,
      retryable: true, recoverable: true,
      suggestedAction: "Investigate runtime failure",
    };
  }

  private _classifyPreview(reason: string, _evidence: readonly Evidence[]): ClassifiedFailure {
    const isDom   = reason.toLowerCase().includes("dom") || reason.toLowerCase().includes("element");
    const isError = reason.toLowerCase().includes("fatal") || reason.toLowerCase().includes("console error");

    if (isDom) return {
      class: "PREVIEW_FAILURE", stage: "PREVIEW", detail: reason,
      retryable: true, recoverable: false,
      suggestedAction: "Fix rendering errors preventing DOM validation",
    };
    if (isError) return {
      class: "PREVIEW_FAILURE", stage: "PREVIEW", detail: reason,
      retryable: false, recoverable: false,
      suggestedAction: "Fix fatal console errors in the preview",
    };
    return {
      class: "PREVIEW_FAILURE", stage: "PREVIEW", detail: reason,
      retryable: true, recoverable: false,
      suggestedAction: "Investigate preview failure",
    };
  }

  private _classifyState(reason: string): ClassifiedFailure {
    return {
      class: "STATE_MISMATCH", stage: "STATE_RECONCILIATION", detail: reason,
      retryable: false, recoverable: false,
      suggestedAction: "Postconditions not satisfied — review task completion",
    };
  }

  private _unknown(stage: VerificationStage, reason: string): ClassifiedFailure {
    return {
      class: "UNKNOWN", stage, detail: reason,
      retryable: false, recoverable: false,  // fail-closed default
      suggestedAction: "Investigate unknown failure; manual review required",
    };
  }
}
