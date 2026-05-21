/**
 * server/verification/typescript/index.ts
 *
 * Public API for the deterministic TypeScript verification subsystem.
 *
 * Primary entry point:
 *   import { verifyTypeScript } from "./typescript/index.ts"
 *   const result = await verifyTypeScript({ workspacePath: "/path/to/project" })
 *
 * GUARANTEE: result.passed === true  iff  tsc --noEmit exited with code 0.
 *            result.passed is NEVER true for timeout, cancellation, or parse failures.
 */

export type {
  VerificationResult,
  VerificationOptions,
  VerificationState,
  TSDiagnostic,
  DiagnosticSeverity,
  EvidenceRecord,
  FailureClass,
  FailureClassification,
  AuditLogEntry,
  AuditEventKind,
} from "./types.ts";

export { TypeScriptVerificationOrchestrator } from "./orchestrator.ts";
export { VerificationStateMachine, StateMachineError } from "./state-machine.ts";
export { TSCProcessRunner } from "./tsc-process-runner.ts";
export { TSConfigResolver } from "./tsconfig-resolver.ts";
export { VerificationResultParser } from "./result-parser.ts";
export { FailureClassifier } from "./failure-classifier.ts";
export { RetryPolicyEngine } from "./retry-policy-engine.ts";
export { VerificationAuditLogger } from "./audit-logger.ts";
export { RuntimeEvidenceStore, evidenceStore } from "./evidence-store.ts";
export { VerificationCache, verificationCache } from "./verification-cache.ts";
export { ImportGraphValidator } from "./import-graph-validator.ts";

// ─── Process-scoped orchestrator singleton ────────────────────────────────────

import { TypeScriptVerificationOrchestrator } from "./orchestrator.ts";
import type { VerificationOptions, VerificationResult } from "./types.ts";

const _orchestrator = new TypeScriptVerificationOrchestrator();

/**
 * verifyTypeScript — primary public function.
 *
 * Runs real `tsc --noEmit`. Returns a deterministic VerificationResult.
 * NEVER returns passed: true unless the compiler exits with code 0.
 */
export async function verifyTypeScript(
  opts: VerificationOptions
): Promise<VerificationResult> {
  return _orchestrator.verify(opts);
}
