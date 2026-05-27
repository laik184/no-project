import type { ExecutorInput, ExecutorResult, TaskExecutionResult } from '../types/executor.types.ts';
import { createExecutionContext, releaseExecutionContext } from './execution-context.ts';
import { executionState } from './execution-state.ts';
import { executeTask } from '../execution/task-executor.ts';
import { executionHistory } from '../execution/execution-history.ts';
import { checkpointManager } from '../recovery/checkpoint-manager.ts';
import {
  emitExecutionStarted,
  emitExecutionCompleted,
  emitExecutionFailed,
} from '../events/executor-events.ts';
import { executorLogger } from '../telemetry/executor-logger.ts';
import { executorMetrics } from '../telemetry/executor-metrics.ts';
import { elapsedMs } from '../utils/execution-helpers.ts';
import { withTimeout } from '../../../orchestration/utils/execution-utils.ts';

export async function runExecutorEngine(input: ExecutorInput): Promise<ExecutorResult> {
  const startedAt = new Date();
  const { runId, projectId } = input;
  const timeoutMs = input.timeoutMs ?? 120_000;

  const ctx = await createExecutionContext(input);
  const session = { sessionId: ctx.isolation.contextId };

  emitExecutionStarted(runId, session.sessionId, ctx.queue.size);

  const results: TaskExecutionResult[] = [];

  try {
    await withTimeout(async () => {
      while (!ctx.queue.isEmpty()) {
        const task = ctx.queue.dequeue()!;
        executionState.setCurrentTask(runId, task.id);

        checkpointManager.pruneOlderThan(runId, 3);

        const result = await executeTask(task, runId, projectId);
        results.push(result);

        executionState.recordTaskDone(runId, result.success);

        if (!result.success) {
          executorLogger.warn(runId, `Task ${task.id} failed — continuing`, {
            error: result.error,
          });
        }

        executorMetrics.recordCompleted(runId, result.durationMs);
      }
    }, { timeoutMs });

  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    executorLogger.error(runId, `Engine error: ${error}`);
    emitExecutionFailed(runId, error);
    executionState.setStatus(runId, 'failed');
    releaseExecutionContext(ctx);

    return {
      ok:             false,
      runId,
      tasksTotal:     input.plan.tasks.length,
      tasksCompleted: results.filter((r) => r.success).length,
      tasksFailed:    results.filter((r) => !r.success).length,
      durationMs:     elapsedMs(startedAt),
      error,
    };
  }

  const tasksCompleted = results.filter((r) => r.success).length;
  const tasksFailed    = results.filter((r) => !r.success).length;
  const durationMs     = elapsedMs(startedAt);
  const ok             = tasksFailed === 0 || tasksCompleted > tasksFailed;

  executionState.setStatus(runId, ok ? 'completed' : 'failed');

  emitExecutionCompleted(runId, tasksCompleted, tasksFailed, durationMs);

  executorLogger.info(runId, `Engine done — ${tasksCompleted}/${results.length} tasks succeeded`, {
    durationMs,
  });

  executorMetrics.recordCompleted(runId, durationMs);
  releaseExecutionContext(ctx);

  return { ok, runId, tasksTotal: input.plan.tasks.length, tasksCompleted, tasksFailed, durationMs };
}
