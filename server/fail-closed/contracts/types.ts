/**
 * server/fail-closed/contracts/types.ts
 *
 * All shared contracts for the fail-closed verification system.
 * Pure types only — no logic, no imports from implementation modules.
 *
 * INVARIANT: The system NEVER returns ok:true without passing ALL gates.
 * INVARIANT: Verification exhaustion ALWAYS results in FAILED state.
 */

// ── Verification stages (ordered pipeline) ────────────────────────────────────

export type VerificationStage =
  | "STATIC"
  | "BUILD"
  | "RUNTIME"
  | "PREVIEW"
  | "STATE_RECONCILIATION";

// ── System state machine states ───────────────────────────────────────────────

export type VerificationSystemState =
  | "IDLE"
  | "VERIFYING_STATIC"
  | "VERIFYING_BUILD"
  | "VERIFYING_RUNTIME"
  | "VERIFYING_PREVIEW"
  | "RECONCILING_STATE"
  | "VERIFIED_SUCCESS"
  | "FAILED"
  | "RECOVERY_REQUIRED"
  | "ROLLING_BACK"
  | "REVERIFYING"
  | "HALTED";

// ── Evidence ──────────────────────────────────────────────────────────────────

export type EvidenceKind =
  | "PROCESS_ALIVE"
  | "HTTP_200_STABLE"
  | "NO_CRASH_LOOP"
  | "PORT_OPEN"
  | "TSC_EXIT_0"
  | "IMPORT_GRAPH_CLEAN"
  | "NO_CIRCULAR_DEPS"
  | "PREVIEW_DOM_VALID"
  | "PREVIEW_NO_FATAL_ERRORS"
  | "PREVIEW_INTERACTIVE"
  | "NPM_DEPS_INTACT"
  | "FILE_EXISTS"
  | "POSTCONDITIONS_MET"
  | "BUILD_SUCCEEDED"
  | "STATIC_ANALYSIS_CLEAN";

export type Evidence = {
  readonly kind: EvidenceKind;
  readonly value: boolean;
  readonly detail: string;
  readonly collectedAt: number;
  readonly source: string;   // tool/subsystem name
  readonly ttlMs: number;
};

// ── Stage results ─────────────────────────────────────────────────────────────

export type StageResult = {
  readonly stage: VerificationStage;
  readonly passed: boolean;
  readonly evidence: readonly Evidence[];
  readonly failureReason: string | null;
  readonly durationMs: number;
};

// ── Completion ────────────────────────────────────────────────────────────────

export type CompletionProposal = {
  readonly proposedBy: string;    // MUST be "llm" | "agent"
  readonly projectId: number;
  readonly runId: string;
  readonly timestamp: number;
  readonly claimedPostconditions: readonly string[];
  readonly workspacePath: string;
  readonly port?: number;
  readonly previewUrl?: string;
};

export type CompletionVerdict =
  | {
      readonly authorized: true;
      readonly runId: string;
      readonly evidence: readonly Evidence[];
      readonly verifiedAt: number;
      readonly durationMs: number;
    }
  | {
      readonly authorized: false;
      readonly runId: string;
      readonly failedGates: readonly string[];
      readonly deniedReason: string;
      readonly durationMs: number;
      readonly recoverySuggested: boolean;
    };

// ── Failure classification ────────────────────────────────────────────────────

export type FailureClass =
  | "STATIC_ANALYSIS_FAILURE"
  | "CIRCULAR_DEP_FAILURE"
  | "BUILD_FAILURE"
  | "TYPESCRIPT_FAILURE"
  | "DEPENDENCY_FAILURE"
  | "PROCESS_FAILURE"
  | "HTTP_FAILURE"
  | "CRASH_LOOP"
  | "PREVIEW_FAILURE"
  | "STATE_MISMATCH"
  | "VERIFICATION_TIMEOUT"
  | "EVIDENCE_MISSING"
  | "RECOVERY_FAILURE"
  | "UNKNOWN";

export type ClassifiedFailure = {
  readonly class: FailureClass;
  readonly stage: VerificationStage;
  readonly detail: string;
  readonly retryable: boolean;
  readonly recoverable: boolean;
  readonly suggestedAction: string;
};

// ── Retry ─────────────────────────────────────────────────────────────────────

export type RetryStrategy = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly targetStage: VerificationStage;
  readonly estimatedConfidence: number;   // 0–1
  readonly semanticVector: readonly string[];  // for similarity detection
};

export type RetryDecision =
  | { readonly shouldRetry: true;  readonly strategy: RetryStrategy; readonly delayMs: number }
  | { readonly shouldRetry: false; readonly reason: string; readonly hardFail: boolean };

// ── Checkpoints ───────────────────────────────────────────────────────────────

export type CheckpointGrade = "GRADE_A" | "GRADE_B" | "GRADE_C" | "UNGRADED";

export type Checkpoint = {
  readonly id: string;
  readonly projectId: number;
  readonly grade: CheckpointGrade;
  readonly createdAt: number;
  readonly evidence: readonly Evidence[];
  readonly workspacePath: string;
  readonly commitHash?: string;
  readonly description?: string;
};

// ── Audit ─────────────────────────────────────────────────────────────────────

export type AuditEventKind =
  | "PIPELINE_STARTED"
  | "STAGE_STARTED"
  | "STAGE_PASSED"
  | "STAGE_FAILED"
  | "GATE_EVALUATED"
  | "GATE_BLOCKED"
  | "COMPLETION_PROPOSED"
  | "COMPLETION_AUTHORIZED"
  | "COMPLETION_DENIED"
  | "RETRY_SCHEDULED"
  | "RETRY_BLACKLISTED"
  | "RECOVERY_STARTED"
  | "ROLLBACK_EXECUTED"
  | "REVERIFICATION_STARTED"
  | "SYSTEM_HALTED";

export type AuditEntry = {
  readonly id: string;
  readonly sequenceNo: number;
  readonly kind: AuditEventKind;
  readonly runId: string;
  readonly stage?: VerificationStage;
  readonly detail: string;
  readonly timestamp: number;
  readonly evidence?: readonly Evidence[];
};

// ── Fail-closed run options ───────────────────────────────────────────────────

export type FailClosedRunOptions = {
  readonly projectId: number;
  readonly workspacePath: string;
  readonly runId: string;
  readonly port?: number;
  readonly previewUrl?: string;
  readonly skipStages?: readonly VerificationStage[];
  readonly maxRetries?: number;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
};
