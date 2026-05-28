/**
 * server/agents/executor/execution/task-executor.ts
 *
 * Manages task-level orchestration.
 * Converts a task into a RuntimeStep, hands it to step-runner, and
 * returns a TaskOutput. No direct dispatch — delegates to step-runner.
 */

import type {
  ExecutionTask,
  ExecutionStep,
  TaskOutput,
  ExecutorExecutionContext,
  ExecutorRetryConfig,
} from '../types/executor.types.ts';
import { registerStep }           from '../core/executor-state.ts';
import { incrementTaskDone }      from '../core/executor-session.ts';
import { executionMonitor }       from '../monitoring/execution-monitor.ts';
import { runStep }                from './step-runner.ts';
import { DEFAULT_RETRY_CONFIG }   from './retry-manager.ts';
import { generateStepId }         from '../utils/execution-utils.ts';
import { coordinateTask }         from '../coordination/tool-coordinator.ts';

// ── Task executor ─────────────────────────────────────────────────────────────

/**
 * Execute a single task:
 *   build step → register in state → run via step-runner → return TaskOutput.
 */
export async function executeTask(
  task:    ExecutionTask,
  context: ExecutorExecutionContext,
  retry:   ExecutorRetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<TaskOutput> {
  // Build the execution step from the task
  const routed = coordinateTask(task, context.sandboxRoot);
  const step: ExecutionStep = {
    stepId:    generateStepId(),
    taskId:    task.taskId,
    toolName:  routed.toolName,
    toolInput: routed.toolInput,
  };

  const rs = registerStep(step);
  executionMonitor.setActiveStep(context.runId, step.stepId);

  const result = await runStep(rs, task, context, retry);

  executionMonitor.incrementDone(context.runId);
  incrementTaskDone(context.sessionId);

  return {
    taskId:   task.taskId,
    kind:     task.kind,
    ok:       result.ok,
    output:   result.output,
    error:    result.error,
    attempts: result.attempts,
  };
}
