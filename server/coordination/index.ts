/**
 * server/coordination/index.ts
 *
 * Public surface of the parallel specialist coordination layer.
 *
 * Consumers (orchestration-engine, run executor) import ONLY from this file.
 * Internal modules are implementation details — never imported directly.
 *
 * Entry points:
 *   coordinateSpecialists(goal, runId, projectId, context?)
 *     → Full lifecycle: decompose → parallel-execute → merge → CoordinationResult
 *
 *   taskDecomposer.decompose(...)
 *     → Plan-only (no execution), for preview / DAG inspection
 *
 *   contextRegistry
 *     → Live context lookup by runId (for external observers)
 *
 *   mergePipeline
 *     → Direct access to the full merge lifecycle
 *
 *   mergeMemoryBridge
 *     → Merge memory / confidence learning store
 */

// ── Re-exports ────────────────────────────────────────────────────────────────

export { taskDecomposer }                    from "./task-decomposer/task-decomposer.ts";
export { dependencyGraphBuilder }            from "./task-decomposer/dependency-graph-builder.ts";
export { executionContextFactory }           from "./scoped-context/execution-context-factory.ts";
export { contextRegistry }                   from "./scoped-context/context-registry.ts";
export { parallelSpecialistCoordinator }     from "./parallel-specialist-coordinator/parallel-specialist-coordinator.ts";
export { specialistWaveRunner }              from "./parallel-specialist-coordinator/specialist-wave-runner.ts";

// Merge intelligence — public pipeline + submodules
export { specialistResultMerger }            from "./aggregation/specialist-result-merger.ts";
export { mergePipeline }                     from "./aggregation/merge-pipeline.ts";
export { mergePlanBuilder }                  from "./aggregation/merge-plan-builder.ts";
export { mergeTransactionManager }           from "./aggregation/merge-transaction-manager.ts";
export { replayJournal }                     from "./aggregation/replay-journal.ts";
export { reconciliationEngine }              from "./aggregation/reconciliation-engine.ts";
export { transactionalPatchApplier }         from "./aggregation/transactional-patch-applier.ts";
export { patchValidationBarrier }            from "./aggregation/patch-validation-barrier.ts";
export { mergeMemoryBridge }                 from "./aggregation/merge-memory-bridge.ts";

// Conflict resolution
export { specialistConflictDetector }        from "./conflict-resolution/specialist-conflict-detector.ts";
export { resolutionStrategy }                from "./conflict-resolution/resolution-strategy.ts";
export { conflictGraphBuilder }              from "./conflict-resolution/conflict-graph-builder.ts";

// Telemetry
export { emitMerge, emitMergeStart, emitMergeComplete,
         emitPatchReceived, emitPatchValidated, emitPatchApplied,
         emitConflictDetected, emitConflictResolved,
         emitReconcileStart, emitReconcileComplete,
         emitTxBegin, emitTxCommit, emitTxRollback,
         emitJournalEntry, emitGraphBuilt, emitMemoryBridgeWrite }
  from "./telemetry/merge-telemetry.ts";

// Dispatcher + verification
export { specialistDispatcher }              from "./specialist-dispatcher/index.ts";
export { wireCoordinationSSE }               from "./telemetry/coordination-sse-bridge.ts";
export { verifyCoordinationResult }          from "./verification/post-coordination-verifier.ts";

// ── Type re-exports ───────────────────────────────────────────────────────────

export type { SpecialistDomain, SpecialistTask, SpecialistResult, FilePatch, FileScope }
  from "./contracts/specialist.contracts.ts";
export type { DecomposedPlan, CoordinationContext, CoordinationResult,
              DependencyGraph, WaveExecutionResult, MergePlan, PatchGroup }
  from "./contracts/coordination.contracts.ts";
export type { MergeResult }        from "./aggregation/specialist-result-merger.ts";
export type { MergeTransaction, CommitResult, TxStatus }
  from "./aggregation/merge-transaction-manager.ts";
export type { JournalEntry, ReplayResult }
  from "./aggregation/replay-journal.ts";
export type { ReconciliationReport, ReconciliationAnomaly, AnomalyKind }
  from "./aggregation/reconciliation-engine.ts";
export type { StrategyRecord, StrategyHint, BridgeStats }
  from "./aggregation/merge-memory-bridge.ts";
export type { ConflictGraph, ConflictNode, ConflictEdge }
  from "./conflict-resolution/conflict-graph-builder.ts";
export type { ResolutionDecision, ResolutionStrategyName }
  from "./conflict-resolution/resolution-strategy.ts";
export type { SpecialistConflict, ConflictReport, ConflictType }
  from "./conflict-resolution/specialist-conflict-detector.ts";

// ── Convenience entry point ───────────────────────────────────────────────────

import { taskDecomposer }                from "./task-decomposer/task-decomposer.ts";
import { parallelSpecialistCoordinator } from "./parallel-specialist-coordinator/parallel-specialist-coordinator.ts";
import type { CoordinationResult }       from "./contracts/coordination.contracts.ts";

/**
 * Full parallel specialist swarm lifecycle.
 *
 * Usage:
 *   const result = await coordinateSpecialists(
 *     "Add a users table and an API endpoint to create users",
 *     runId, projectId, { existingFiles: [...] }
 *   );
 */
export async function coordinateSpecialists(
  goal:      string,
  runId:     string,
  projectId: number,
  context:   Record<string, unknown> = {},
): Promise<CoordinationResult> {
  const plan = taskDecomposer.decompose(goal, runId, projectId, context);
  return parallelSpecialistCoordinator.coordinate(plan);
}
