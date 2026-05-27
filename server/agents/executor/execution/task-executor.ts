import type { PlanTask, TaskExecutionResult } from '../types/executor.types.ts';
import { interpretTask } from '../planning/task-interpreter.ts';
import { runStep } from './step-runner.ts';
import { executionHistory } from './execution-history.ts';
import { runtimeMonitor } from '../runtime/runtime-monitor.ts';
import { retryHandler } from '../recovery/retry-handler.ts';
import { failureRecovery } from '../recovery/failure-recovery.ts';
import { emitStepStarted, emitStepCompleted } from '../events/executor-events.ts';
import { executorLogger } from '../telemetry/executor-logger.ts';
import { elapsedMs } from '../utils/execution-helpers.ts';

export async function executeTask(
  task:      PlanTask,
  runId:     string,
  projectId: string,
): Promise<TaskExecutionResult> {
  const startedAt  = new Date();
  const steps      = interpretTask(task);
  const artifacts: string[] = [];
  let   stepsRun   = 0;

  executorLogger.info(runId, `Task started: ${task.id} — ${task.title}`, {
    category:  task.category,
    stepCount: steps.length,
  });

  for (const step of steps) {
    emitStepStarted(runId, task.id, step.id, step.type, step.label);
    stepsRun++;

    let result = await retryHandler.withRetry(
      step.id, runId,
      () => runStep(step, runId, projectId),
      { maxAttempts: 2 },
    ).catch((err) => {
      const error = err instanceof Error ? err.message : String(err);
      return {
        stepId:     step.id,
        success:    false as const,
        durationMs: 0,
        error,
      };
    });

    executionHistory.record(runId, task.id, result, step.type);
    runtimeMonitor.recordStep(runId, result.success);
    emitStepCompleted(runId, task.id, step.id, step.type, result.success, result.durationMs, result.filePath);

    if (result.filePath) artifacts.push(result.filePath);

    if (!result.success) {
      const recovery = failureRecovery.handle(runId, task.id, result.error ?? 'step failed', 1);

      if (recovery.action === 'abort') {
        executorLogger.error(runId, `Task ${task.id} aborting on step ${step.id}`);
        return {
          taskId:     task.id,
          success:    false,
          durationMs: elapsedMs(startedAt),
          stepsRun,
          error:      result.error ?? 'Step failed',
          artifacts,
        };
      }

      if (recovery.action === 'skip') {
        executorLogger.warn(runId, `Skipping failed step ${step.id} (${step.type})`);
        continue;
      }
    }

    if (!runtimeMonitor.isHealthy(runId)) {
      executorLogger.warn(runId, `High failure rate — stopping task ${task.id} early`);
      break;
    }
  }

  const success = executionHistory.countFailures(runId) === 0 ||
    (stepsRun > 0 && artifacts.length > 0);

  executorLogger.info(runId, `Task ${task.id} done — success=${success}`, {
    stepsRun,
    artifacts: artifacts.length,
    durationMs: elapsedMs(startedAt),
  });

  return {
    taskId:     task.id,
    success,
    durationMs: elapsedMs(startedAt),
    stepsRun,
    artifacts,
  };
}
