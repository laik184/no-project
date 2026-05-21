/**
 * server/runtime-truth/index.ts
 *
 * Public API for the Runtime Truth Engine.
 *
 * Usage:
 *   import { runVerification } from "./runtime-truth/index.ts"
 *
 *   const report = await runVerification({
 *     projectId: 1,
 *     workspacePath: "/path/to/project",
 *     port: 3001,
 *     previewUrl: "http://localhost:3001",
 *   });
 *
 *   if (!report.passed) {
 *     // report.recoverySignal.recommendedActions tells you what to do
 *   }
 *
 * GUARANTEE:
 *   report.passed === true  iff ALL required pipeline stages return PASSED.
 *   No stage can be skipped unless explicitly listed in opts.skipStages.
 *   State VERIFIED is only set here — no other module may authorize it.
 */

export type {
  RuntimeHealthState,
  VerificationStage,
  StageResult,
  StageStatus,
  EvidenceItem,
  EvidenceKind,
  EvidenceClaim,
  RuntimeEvent,
  RuntimeEventKind,
  RuntimeSnapshot,
  RuntimeChecksums,
  ProcessHealthReport,
  HTTPHealthReport,
  DependencyIntegrityReport,
  RecoverySignal,
  RecoveryAction,
  VerificationOptions,
  VerificationReport,
} from "./types.ts";

export { RuntimeEventBus, runtimeEventBus }   from "./event-bus.ts";
export { RuntimeStateMachine, StateTransitionGuard, IllegalTransitionError } from "./state-machine.ts";
export { RuntimeStateStore }                  from "./state-store.ts";
export { ProcessHealthMonitor }               from "./process-health-monitor.ts";
export { DependencyIntegrityVerifier }        from "./dependency-integrity-verifier.ts";
export { HTTPHealthVerifier }                 from "./http-health-verifier.ts";
export { PreviewBehaviorVerifier }            from "./preview-behavior-verifier.ts";
export { RuntimeEvidenceCollector }           from "./evidence-collector.ts";
export { RuntimeChecksumEngine }              from "./checksum-engine.ts";
export { RuntimeSnapshotBuilder }             from "./snapshot-builder.ts";
export { RecoverySignalEmitter }              from "./recovery-signal-emitter.ts";
export { VerificationPolicyEngine }           from "./policy-engine.ts";
export { VerificationOrchestrator }           from "./orchestrator.ts";

// ─── Process-scoped orchestrator singleton ────────────────────────────────────

import { VerificationOrchestrator } from "./orchestrator.ts";
import type { VerificationOptions, VerificationReport } from "./types.ts";

const _orchestrator = new VerificationOrchestrator();

/**
 * runVerification — primary public function.
 *
 * Executes the full deterministic verification pipeline.
 * Returns a VerificationReport with evidence-backed pass/fail per stage.
 */
export async function runVerification(
  opts: VerificationOptions
): Promise<VerificationReport> {
  return _orchestrator.run(opts);
}

/**
 * getOrchestrator — returns the process-scoped singleton if you need
 * direct access to the state store, event bus, or evidence collector.
 */
export function getOrchestrator(): VerificationOrchestrator {
  return _orchestrator;
}
