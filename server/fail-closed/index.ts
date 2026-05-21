/**
 * server/fail-closed/index.ts
 *
 * Public API for the fail-closed verification system.
 *
 * Entry point: runFailClosed(opts, proposal) → RunResult
 *
 * The coordinator is stateless per-call — each invocation creates a fresh
 * VerificationStateMachine, AuditLog, and CompletionAuthority.
 * No global state. No singletons.
 */

export { VerificationCoordinator } from "./coordinator/verification-coordinator.ts";
export type { RunResult }          from "./coordinator/verification-coordinator.ts";
export type {
  FailClosedRunOptions,
  CompletionProposal,
  CompletionVerdict,
  StageResult,
  Evidence,
  EvidenceKind,
  VerificationStage,
  VerificationSystemState,
  CheckpointGrade,
  ClassifiedFailure,
  AuditEntry,
  AuditEventKind,
} from "./contracts/types.ts";
export { VerificationAuditLog }    from "./audit/verification-audit-log.ts";
export { FailureClassifier }       from "./audit/failure-classifier.ts";
export { EvidenceGate }            from "./gates/evidence-gate.ts";
export { CompletionAuthority }     from "./gates/completion-authority.ts";

import { VerificationCoordinator } from "./coordinator/verification-coordinator.ts";
import type { FailClosedRunOptions, CompletionProposal } from "./contracts/types.ts";
import type { RunResult } from "./coordinator/verification-coordinator.ts";

/**
 * Top-level convenience function.
 * Creates a fresh coordinator and runs the full fail-closed pipeline.
 */
export async function runFailClosed(
  opts: FailClosedRunOptions,
  proposal: CompletionProposal,
): Promise<RunResult> {
  return new VerificationCoordinator().run(opts, proposal);
}
