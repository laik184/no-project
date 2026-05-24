/**
 * specialist-wave-runner.ts
 *
 * Executes a single wave of SpecialistTasks in parallel using CentralWorkerPool.
 * Single responsibility: parallel fan-out + fan-in for one wave.
 *
 * Safety model:
 * - File locks are acquired before execution; released on completion or failure.
 * - AbortSignal from CoordinationContext propagates cancellation to all tasks.
 * - All failures are captured — never thrown — so one failure doesn't kill peers.
 * - Telemetry emitted on every state transition.
 */

import { centralWorkerPool }     from "../../distributed/workers/central-worker-pool.ts";
import { unifiedLockCoordinator } from "../../quantum/locks/unified-lock-coordinator.ts";
import { specialistDispatcher }  from "../specialist-dispatcher/index.ts";
import { bus }                   from "../../infrastructure/events/bus.ts";
import type { SpecialistTask, SpecialistResult }
  from "../contracts/specialist.contracts.ts";
import type { CoordinationContext, WaveExecutionResult }
  from "../contracts/coordination.contracts.ts";
import { executionContextFactory } from "../scoped-context/execution-context-factory.ts";

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
    agentName: "specialist-wave-runner",
    eventType,
    payload,
    ts: Date.now(),
  });
}

// ── Lock helpers ──────────────────────────────────────────────────────────────

async function acquireTaskLocks(task: SpecialistTask, runId: string): Promise<(() => void)[]> {
  const releases: (() => void)[] = [];
  for (const filePath of task.scope.exclusiveFiles) {
    const result = await unifiedLockCoordinator.acquire(filePath, {
      ownerId:   `specialist:${task.domain}:${task.taskId}`,
      runId,
      timeoutMs: 10_000,
    });
    if (result.acquired && result.handle) {
      releases.push(() => result.handle!.release());
    }
  }
  return releases;
}

function releaseAll(releases: (() => void)[]): void {
  for (const release of releases) {
    try { release(); } catch { /* ignore release errors */ }
  }
}

// ── Single-task executor ──────────────────────────────────────────────────────

async function executeTask(
  task:    SpecialistTask,
  ctx:     CoordinationContext,
): Promise<SpecialistResult> {
  const { runId, projectId } = task;
  const t0 = Date.now();

  emit(runId, projectId, "agent.start", { taskId: task.taskId, domain: task.domain });
  executionContextFactory.markStarted(ctx, task.taskId);

  let locks: (() => void)[] = [];
  try {
    emit(runId, projectId, "lock.acquire", { taskId: task.taskId, files: task.scope.exclusiveFiles });
    locks = await acquireTaskLocks(task, runId);
    emit(runId, projectId, "lock.acquired", { taskId: task.taskId });

    // Dispatch to the real LLM-backed SpecialistDispatcher via CentralWorkerPool.
    // The worker pool governs admission control, backpressure, and timeout protection.
    // AbortSignal from the coordination context propagates cancellation.
    const signal = ctx.abortController.signal;

    const submittedResult = await centralWorkerPool.submit<SpecialistResult>({
      taskId:    task.taskId,
      runId,
      priority:  "normal" as const,
      timeoutMs: task.timeoutMs,
      fn:        () => specialistDispatcher.dispatch(task, signal),
    } as Parameters<typeof centralWorkerPool.submit>[0]);

    const durationMs = Date.now() - t0;

    if (submittedResult.success === false) {
      throw new Error(submittedResult.error ?? "worker_pool_rejection");
    }

    // Unwrap: worker pool wraps results in { success, data } envelope
    const result: SpecialistResult =
      (submittedResult as { success: true; data: SpecialistResult }).data ?? {
        taskId:     task.taskId,
        domain:     task.domain,
        success:    false,
        patches:    [],
        artifacts:  {},
        durationMs,
        error:      "pool_unwrap_failed",
      };

    executionContextFactory.markCompleted(ctx, result);
    emit(runId, projectId, "agent.complete", { taskId: task.taskId, domain: task.domain, durationMs });
    return result;

  } catch (err: unknown) {
    const error      = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - t0;
    executionContextFactory.markFailed(ctx, task.taskId, error);
    emit(runId, projectId, "agent.failed", { taskId: task.taskId, domain: task.domain, error, durationMs });
    return {
      taskId: task.taskId, domain: task.domain, success: false,
      patches: [], artifacts: {}, durationMs, error, retryable: true,
    };
  } finally {
    releaseAll(locks);
    emit(runId, projectId, "lock.release", { taskId: task.taskId });
  }
}

// ── Wave runner ───────────────────────────────────────────────────────────────

export class SpecialistWaveRunner {
  /**
   * Execute all tasks in a wave concurrently.
   * Returns after all tasks settle (success or failure).
   * Never throws — all errors are captured in WaveExecutionResult.
   */
  async runWave(
    waveIndex: number,
    tasks:     SpecialistTask[],
    ctx:       CoordinationContext,
  ): Promise<WaveExecutionResult> {
    const { runId, projectId } = ctx;
    const t0 = Date.now();

    if (executionContextFactory.isAborted(ctx)) {
      return { waveIndex, taskIds: [], results: [], succeeded: 0, failed: 0, durationMs: 0 };
    }

    emit(runId, projectId, "DAG.node.start", {
      waveIndex,
      taskCount: tasks.length,
      domains:   tasks.map(t => t.domain),
    });

    // Parallel fan-out
    const results = await Promise.all(
      tasks.map(task => executeTask(task, ctx))
    );

    const succeeded  = results.filter(r => r.success).length;
    const failed     = results.filter(r => !r.success).length;
    const durationMs = Date.now() - t0;

    emit(runId, projectId, "DAG.node.complete", {
      waveIndex, succeeded, failed, durationMs,
    });

    return {
      waveIndex,
      taskIds:  tasks.map(t => t.taskId),
      results,
      succeeded,
      failed,
      durationMs,
    };
  }
}

export const specialistWaveRunner = new SpecialistWaveRunner();
