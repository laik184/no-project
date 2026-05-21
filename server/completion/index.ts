/**
 * server/completion/index.ts
 * Public API for the completion gate system.
 * LLM cannot declare success — only this system can.
 */

export { runCompletionGate }              from "./completion-gate.ts";
export { runBuildValidationCheck }        from "./checks/build-validation-check.ts";
export { runRuntimeHealthCheck }          from "./checks/runtime-health-check.ts";
export { runBrowserValidationCheck }      from "./checks/browser-validation-check.ts";
export { runSecurityValidationCheck }     from "./checks/security-validation-check.ts";
export { runDependencyValidationCheck }   from "./checks/dependency-validation-check.ts";
export { runFinalReconciliation }         from "./runtime/final-reconciliation.ts";
export type {
  CompletionGateInput, CompletionGateOutput,
  CompletionCheckResult, CompletionCheckName,
  CompletionStatus, ReconciliationState,
} from "./types.ts";
