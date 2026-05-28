/**
 * server/agents/coderx/execution/step-runner.ts
 *
 * Executes one coding step through dispatcher-client → tool-dispatcher → tool.
 * Controls the retry loop for a single step.
 *
 * Execution chain: step-runner → dispatcher-client → tool-dispatcher → registry → tool
 * No intermediate routing layers. No direct tool execution.
 */

import type {
  CodingStep,
  CodingTask,
  CoderXExecutionContext,
  CoderXRetryConfig,
  CodingTaskOutput,
  CodingTaskKind,
} from '../types/coderx.types.ts';
import { executeTool }                 from '../coordination/dispatcher-client.ts';
import { coordinateCodingTask }        from '../coordination/tool-coordinator.ts';
import { assertRoutedCodingStep }      from '../validation/coding-validator.ts';
import { toToolContext }               from '../core/coderx-context.ts';
import { canRetry, waitForRetry }      from './retry-manager.ts';
import {
  registerStep, markRunning, markCompleted,
  markFailed, markRetrying,
} from '../core/coderx-state.ts';
import { executionMonitor }  from '../monitoring/execution-monitor.ts';
import { failureMonitor }    from '../monitoring/failure-monitor.ts';
import { coderxLogger }      from '../telemetry/coderx-logger.ts';
import { coderxMetrics }     from '../telemetry/coderx-metrics.ts';
import { executionHistory }  from '../memory/execution-history.ts';
import { toErrorMessage }    from '../utils/coding-utils.ts';

export async function runStep(
  step:    CodingStep,
  task:    CodingTask,
  context: CoderXExecutionContext,
  config:  CoderXRetryConfig,
): Promise<CodingTaskOutput> {
  const runtime = registerStep(step);
  let   attempt = 0;

  while (true) {
    markRunning(step.stepId);
    executionMonitor.markStepActive(context.runId, step.stepId);
    coderxLogger.stepStarted(context.runId, step.stepId, step.toolName);

    const start = Date.now();

    // ── Route task → tool name + input, then dispatch directly ────────────────
    const routed  = coordinateCodingTask(task);
    assertRoutedCodingStep(routed);
    const toolCtx = toToolContext(context);
    const result  = await executeTool(routed.toolName, routed.toolInput, toolCtx);

    const dur = Date.now() - start;

    executionMonitor.clearActiveStep(context.runId);

    if (result.ok) {
      markCompleted(step.stepId, result.data);
      coderxLogger.stepCompleted(context.runId, step.stepId, dur);
      coderxMetrics.recordStepSuccess(context.runId);
      executionHistory.recordSnapshot(
        context.runId, step.stepId, step.taskId,
        step.toolName, true, dur, result.data,
      );
      return { taskId: task.taskId, kind: task.kind, ok: true, output: result.data, attempts: attempt + 1 };
    }

    // ── Failure path ──────────────────────────────────────────────────────────
    const error = result.error;
    coderxLogger.stepFailed(context.runId, step.stepId, error, attempt);
    coderxMetrics.recordStepFailure(context.runId);
    executionHistory.recordSnapshot(
      context.runId, step.stepId, step.taskId,
      step.toolName, false, dur, undefined, error,
    );

    const failureRecord = failureMonitor.buildRecord(
      step.stepId, step.taskId, context.runId,
      task.kind as CodingTaskKind, step.toolName, error, attempt,
    );
    failureMonitor.record(failureRecord);

    if (canRetry(error, attempt, config)) {
      attempt++;
      markRetrying(step.stepId);
      runtime.retryCount = attempt;
      await waitForRetry(context.runId, step.stepId, step.taskId, attempt, error, config);
      continue;
    }

    markFailed(step.stepId, error);
    return { taskId: task.taskId, kind: task.kind, ok: false, error, attempts: attempt + 1 };
  }
}
