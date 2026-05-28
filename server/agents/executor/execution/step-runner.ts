/**
 * server/agents/executor/execution/step-runner.ts
 *
 * Executes one execution step end-to-end:
 *   validate → transition → dispatch via dispatcher-client → record result.
 * No direct tool execution — all dispatch goes through dispatcher-client.ts.
 */

import type {
  RuntimeStep,
  ExecutionTask,
  ExecutorExecutionContext,
  ExecutorRetryConfig,
} from '../types/executor.types.ts';
import { executeTool }               from '../coordination/dispatcher-client.ts';
import { toToolContext }             from '../core/executor-context.ts';
import { withRetry, DEFAULT_RETRY_CONFIG } from './retry-manager.ts';
import { assertTransition }          from '../validation/integrity-validator.ts';
import { failureMonitor }            from '../monitoring/failure-monitor.ts';
import { executionMonitor }          from '../monitoring/execution-monitor.ts';
import { executorLogger }            from '../telemetry/executor-logger.ts';
import { executorMetrics }           from '../telemetry/executor-metrics.ts';
import { elapsedMs, toErrorMessage } from '../utils/execution-utils.ts';
import {
  markRunning,
  markRetrying,
  markCompleted,
  markFailed,
} from '../core/executor-state.ts';

// ── Step result ───────────────────────────────────────────────────────────────

export interface StepRunResult {
  ok:          boolean;
  stepId:      string;
  taskId:      string;
  output?:     unknown;
  error?:      string;
  attempts:    number;
  durationMs:  number;
}

// ── Runner ────────────────────────────────────────────────────────────────────

export async function runStep(
  rs:      RuntimeStep,
  task:    ExecutionTask,
  context: ExecutorExecutionContext,
  retry:   ExecutorRetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<StepRunResult> {
  const { stepId, taskId } = rs.step;
  const startedAt           = new Date();

  // transition: pending → running
  assertTransition(stepId, rs.status, 'running');
  markRunning(stepId);
  executorLogger.taskStarted(context.runId, taskId, task.kind, stepId);
  executorMetrics.recordStarted(task.kind);
  executionMonitor.setActiveStep(context.runId, stepId);

  const retryResult = await withRetry(
    async () => {
      const result = await executeTool(rs.step.toolName, rs.step.toolInput, toToolContext(context));
      if (!result.ok) {
        throw new Error(result.error ?? `Tool "${rs.step.toolName}" returned failure`);
      }
      return result.data;
    },
    retry,
    (attempt, error, delayMs) => {
      markRetrying(stepId);
      executorLogger.taskRetrying(context.runId, taskId, task.kind, attempt, delayMs);
      executorMetrics.recordRetry(task.kind);
      failureMonitor.record(stepId, taskId, context.runId, task.kind, rs.step.toolName, error, attempt);
    },
  );

  const duration = elapsedMs(startedAt);
  executionMonitor.clearActiveStep(context.runId);

  if (retryResult.ok) {
    markCompleted(stepId, retryResult.data);
    executorLogger.taskCompleted(context.runId, taskId, task.kind, duration);
    executorMetrics.recordCompleted(task.kind, duration);
    failureMonitor.clear(stepId);

    return { ok: true, stepId, taskId, output: retryResult.data, attempts: retryResult.attempts, durationMs: duration };
  } else {
    const error = retryResult.error ?? 'Unknown error';
    markFailed(stepId, error);
    executorLogger.taskFailed(context.runId, taskId, task.kind, error, retryResult.attempts);
    executorMetrics.recordFailed(task.kind, duration);
    failureMonitor.record(stepId, taskId, context.runId, task.kind, rs.step.toolName, error, retryResult.attempts);

    return { ok: false, stepId, taskId, error, attempts: retryResult.attempts, durationMs: duration };
  }
}
