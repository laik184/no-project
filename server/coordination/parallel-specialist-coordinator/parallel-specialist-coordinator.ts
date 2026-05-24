/**
 * parallel-specialist-coordinator.ts
 *
 * Orchestrates the complete parallel specialist swarm lifecycle.
 * Single responsibility: wave sequencing + lock coordination + result aggregation.
 *
 * Lifecycle per run:
 *   1. Receive DecomposedPlan
 *   2. Register isolated CoordinationContext
 *   3. For each wave in the DependencyGraph:
 *      a. Resolve task objects for this wave
 *      b. Run wave in parallel (SpecialistWaveRunner)
 *      c. Collect results into context
 *   4. Merge all results → CoordinationResult
 *   5. Clean up context
 *
 * Failure model:
 * - A wave with ALL tasks failed → abort remaining waves.
 * - A wave with SOME failures → continue (partial success).
 * - Aborted run → return partial CoordinationResult with error.
 */

import { bus }                   from "../../infrastructure/events/bus.ts";
import { contextRegistry }       from "../scoped-context/context-registry.ts";
import { executionContextFactory } from "../scoped-context/execution-context-factory.ts";
import { specialistWaveRunner }  from "./specialist-wave-runner.ts";
import { specialistResultMerger } from "../aggregation/specialist-result-merger.ts";
import type { DecomposedPlan, CoordinationResult, WaveExecutionResult }
  from "../contracts/coordination.contracts.ts";
import type { SpecialistTask }   from "../contracts/specialist.contracts.ts";

// ── Telemetry ─────────────────────────────────────────────────────────────────

function emit(
  runId:     string,
  projectId: number,
  eventType: string,
  payload:   Record<string, unknown>,
): void {
  bus.emit("agent.event", {
    runId, projectId,
    phase:     "coordination",
    agentName: "parallel-specialist-coordinator",
    eventType,
    payload,
    ts: Date.now(),
  });
}

// ── Parallelism factor ────────────────────────────────────────────────────────

function computeParallelismFactor(waveResults: WaveExecutionResult[]): number {
  if (waveResults.length === 0) return 1;
  const total  = waveResults.reduce((s, w) => s + w.taskIds.length, 0);
  const serial = waveResults.length; // if everything was sequential
  return total > 0 ? total / serial : 1;
}

// ── Coordinator ───────────────────────────────────────────────────────────────

export class ParallelSpecialistCoordinator {
  /**
   * Execute all specialists in the plan using wave-parallel execution.
   * Always resolves — never rejects.
   */
  async coordinate(plan: DecomposedPlan): Promise<CoordinationResult> {
    const { runId, projectId } = plan;
    const t0 = Date.now();

    emit(runId, projectId, "coordination.start", {
      goal:       plan.goal,
      taskCount:  plan.tasks.length,
      waveCount:  plan.estimatedWaves,
      domains:    plan.tasks.map(t => t.domain),
    });

    // Create and register isolated context
    const ctx = executionContextFactory.create(plan);
    contextRegistry.register(ctx);

    // Index tasks by ID for fast lookup
    const taskById = new Map<string, SpecialistTask>(
      plan.tasks.map(t => [t.taskId, t])
    );

    const waveResults: WaveExecutionResult[] = [];

    try {
      for (let wi = 0; wi < plan.dependencyGraph.waves.length; wi++) {
        if (executionContextFactory.isAborted(ctx)) {
          emit(runId, projectId, "coordination.aborted", { waveIndex: wi });
          break;
        }

        const waveTaskIds = plan.dependencyGraph.waves[wi];
        const waveTasks   = waveTaskIds
          .map(id => taskById.get(id))
          .filter((t): t is SpecialistTask => !!t);

        if (waveTasks.length === 0) continue;

        emit(runId, projectId, "DAG.node.start", {
          waveIndex: wi,
          taskIds:   waveTaskIds,
          domains:   waveTasks.map(t => t.domain),
        });

        const waveResult = await specialistWaveRunner.runWave(wi, waveTasks, ctx);
        waveResults.push(waveResult);

        // Abort if entire wave failed (no survivors)
        if (waveResult.succeeded === 0 && waveResult.failed > 0) {
          emit(runId, projectId, "coordination.wave.total_failure", { waveIndex: wi });
          ctx.abortController.abort();
          break;
        }
      }

      // Aggregate all specialist results
      const allResults      = executionContextFactory.allResults(ctx);
      const mergeResult     = await specialistResultMerger.merge(runId, allResults);
      const durationMs      = Date.now() - t0;
      const parallelFactor  = computeParallelismFactor(waveResults);
      const success         = ctx.failedTaskIds.size === 0 && !executionContextFactory.isAborted(ctx);

      emit(runId, projectId, success ? "coordination.complete" : "coordination.partial", {
        succeeded: ctx.completedTaskIds.size,
        failed:    ctx.failedTaskIds.size,
        durationMs,
        parallelismFactor: parallelFactor,
      });

      return {
        runId,
        projectId,
        success,
        results:           allResults,
        mergedPatches:     mergeResult.patches,
        durationMs,
        wavesExecuted:     waveResults.length,
        specialistsRan:    allResults.length,
        parallelismFactor: parallelFactor,
      };

    } catch (err: unknown) {
      const error      = err instanceof Error ? err.message : String(err);
      const durationMs = Date.now() - t0;
      emit(runId, projectId, "coordination.failed", { error, durationMs });
      return {
        runId, projectId, success: false,
        results: executionContextFactory.allResults(ctx),
        mergedPatches: [],
        durationMs, wavesExecuted: waveResults.length,
        specialistsRan: 0, parallelismFactor: 1, error,
      };
    } finally {
      contextRegistry.unregister(runId);
    }
  }
}

export const parallelSpecialistCoordinator = new ParallelSpecialistCoordinator();
