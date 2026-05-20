/**
 * autonomous-debug/index.ts
 *
 * Public API surface for the autonomous debugging system.
 * Consumers import from here — not from internal submodules.
 */

export { handleCrash, resetProject, getOrchestratorState } from "./core/debug-orchestrator.ts";
export { initMemory, getMemory, buildMemorySummary }       from "./memory/recovery-memory.ts";
export { validatePatch }                                    from "./patchers/patch-validator.ts";
export { rollbackToCheckpoint }                             from "./patchers/rollback-manager.ts";
export { extractErrors, extractAffectedFiles }             from "./analyzers/stack-trace-extractor.ts";
export { correlateErrors, renderCorrelations }             from "./analyzers/error-correlator.ts";
export { verifyAfterPatch, capturePrePatchErrorCount }     from "./verification/post-patch-verifier.ts";
export type {
  DebugSession, DebugVerdict, ExtractedError, ErrorCorrelation,
  FixAttempt, ProjectMemory, PatchCheckpoint, EscalationEvent,
} from "./types/debug-types.ts";
