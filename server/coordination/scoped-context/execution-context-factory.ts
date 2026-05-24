/**
 * execution-context-factory.ts
 *
 * Creates isolated CoordinationContexts per run.
 * Single responsibility: context construction + safe mutation helpers.
 *
 * Design rules:
 * - Context is owned by the factory; specialists receive a read-only view.
 * - Mutation only via explicit factory methods (markStarted, markCompleted, etc.)
 * - AbortController is scoped per context — cancels the entire run if needed.
 */

import type { DecomposedPlan, CoordinationContext } from "../contracts/coordination.contracts.ts";
import type { SpecialistResult }                    from "../contracts/specialist.contracts.ts";

// ── Factory ───────────────────────────────────────────────────────────────────

export class ExecutionContextFactory {
  /**
   * Create a new isolated CoordinationContext for a run.
   * The context is mutable only via the mutation helpers below.
   */
  create(plan: DecomposedPlan): CoordinationContext {
    return {
      runId:            plan.runId,
      projectId:        plan.projectId,
      goal:             plan.goal,
      plan,
      activeTaskIds:    new Set<string>(),
      completedTaskIds: new Set<string>(),
      failedTaskIds:    new Set<string>(),
      results:          new Map<string, SpecialistResult>(),
      startedAt:        Date.now(),
      abortController:  new AbortController(),
    };
  }

  // ── Mutation helpers ────────────────────────────────────────────────────────

  /** Mark a task as actively running. */
  markStarted(ctx: CoordinationContext, taskId: string): void {
    ctx.activeTaskIds.add(taskId);
  }

  /** Record a successful specialist result and move task to completed. */
  markCompleted(ctx: CoordinationContext, result: SpecialistResult): void {
    ctx.activeTaskIds.delete(result.taskId);
    ctx.completedTaskIds.add(result.taskId);
    ctx.results.set(result.taskId, result);
  }

  /** Record a failed task. Optionally abort the entire run. */
  markFailed(
    ctx:           CoordinationContext,
    taskId:        string,
    error:         string,
    abortRun:      boolean = false,
  ): void {
    ctx.activeTaskIds.delete(taskId);
    ctx.failedTaskIds.add(taskId);

    const failedResult: SpecialistResult = {
      taskId,
      domain:     ctx.plan.tasks.find(t => t.taskId === taskId)?.domain ?? "fullstack",
      success:    false,
      patches:    [],
      artifacts:  {},
      durationMs: 0,
      error,
      retryable:  true,
    };
    ctx.results.set(taskId, failedResult);

    if (abortRun) ctx.abortController.abort();
  }

  // ── Read helpers ────────────────────────────────────────────────────────────

  /** True if the run has been aborted. */
  isAborted(ctx: CoordinationContext): boolean {
    return ctx.abortController.signal.aborted;
  }

  /** All results collected so far (including failed ones). */
  allResults(ctx: CoordinationContext): SpecialistResult[] {
    return Array.from(ctx.results.values());
  }

  /** Completion percentage (0–100). */
  progressPct(ctx: CoordinationContext): number {
    const total = ctx.plan.tasks.length;
    if (total === 0) return 100;
    return Math.round(
      ((ctx.completedTaskIds.size + ctx.failedTaskIds.size) / total) * 100
    );
  }

  /** Elapsed milliseconds since context was created. */
  elapsedMs(ctx: CoordinationContext): number {
    return Date.now() - ctx.startedAt;
  }
}

export const executionContextFactory = new ExecutionContextFactory();
