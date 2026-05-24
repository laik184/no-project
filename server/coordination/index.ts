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
 */

// ── Re-exports ────────────────────────────────────────────────────────────────

export { taskDecomposer }                    from "./task-decomposer/task-decomposer.ts";
export { dependencyGraphBuilder }            from "./task-decomposer/dependency-graph-builder.ts";
export { executionContextFactory }           from "./scoped-context/execution-context-factory.ts";
export { contextRegistry }                   from "./scoped-context/context-registry.ts";
export { parallelSpecialistCoordinator }     from "./parallel-specialist-coordinator/parallel-specialist-coordinator.ts";
export { specialistWaveRunner }              from "./parallel-specialist-coordinator/specialist-wave-runner.ts";
export { specialistResultMerger }            from "./aggregation/specialist-result-merger.ts";
export { mergePlanBuilder }                  from "./aggregation/merge-plan-builder.ts";
export { specialistConflictDetector }        from "./conflict-resolution/specialist-conflict-detector.ts";
export { resolutionStrategy }                from "./conflict-resolution/resolution-strategy.ts";
export { specialistDispatcher }              from "./specialist-dispatcher/index.ts";
export { wireCoordinationSSE }               from "./telemetry/coordination-sse-bridge.ts";
export { verifyCoordinationResult }          from "./verification/post-coordination-verifier.ts";

// ── Type re-exports ───────────────────────────────────────────────────────────

export type { SpecialistDomain, SpecialistTask, SpecialistResult, FilePatch, FileScope }
  from "./contracts/specialist.contracts.ts";
export type { DecomposedPlan, CoordinationContext, CoordinationResult,
              DependencyGraph, WaveExecutionResult, MergePlan, PatchGroup }
  from "./contracts/coordination.contracts.ts";

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
