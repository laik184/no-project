/**
 * server/agents/coderx/execution/task-executor.ts
 *
 * Manages coding task orchestration.
 * Converts coding plan steps into dispatched executions via step-runner.
 * No direct tool execution — delegates entirely to step-runner.
 */

import type {
  CodingTask,
  CodingStep,
  CoderXExecutionContext,
  CoderXRetryConfig,
  CodingTaskOutput,
} from '../types/coderx.types.ts';
import { runStep }          from './step-runner.ts';
import { generateStepId }  from '../utils/coding-utils.ts';
import { workingMemory }   from '../memory/working-memory.ts';
import { executionHistory } from '../memory/execution-history.ts';
import { decide }          from '../reasoning/decision-engine.ts';
import { getStep }         from '../core/coderx-state.ts';
import { markSkipped }     from '../core/coderx-state.ts';
import { coderxLogger }    from '../telemetry/coderx-logger.ts';
import { coderxMetrics }   from '../telemetry/coderx-metrics.ts';

export interface TaskExecutorResult {
  outputs:        CodingTaskOutput[];
  tasksFailed:    number;
  tasksSkipped:   number;
  shouldAbort:    boolean;
}

export async function executeTasks(
  tasks:         CodingTask[],
  context:       CoderXExecutionContext,
  retryConfig:   CoderXRetryConfig,
  stopOnFailure: boolean,
): Promise<TaskExecutorResult> {
  const outputs:     CodingTaskOutput[] = [];
  let   tasksFailed  = 0;
  let   tasksSkipped = 0;
  let   shouldAbort  = false;

  for (const task of tasks) {
    if (shouldAbort) {
      skipTask(task, context.runId, outputs);
      tasksSkipped++;
      continue;
    }

    workingMemory.setActiveTask(context.runId, task.taskId);

    const step: CodingStep = {
      stepId:    generateStepId(),
      taskId:    task.taskId,
      toolName:  '', // populated by step-runner via routing
      toolInput: task.input,
    };

    const output = await runStep(step, task, context, retryConfig);
    outputs.push(output);
    executionHistory.recordTaskOutput(context.runId, output);

    if (output.ok) {
      workingMemory.markTaskCompleted(context.runId, task.taskId);
      coderxMetrics.recordStepSuccess(context.runId);
    } else {
      workingMemory.markTaskFailed(context.runId, task.taskId);
      tasksFailed++;

      const rs = getStep(step.stepId);
      if (rs) {
        const decision = decide(rs, retryConfig, stopOnFailure);
        coderxLogger.decision(context.runId, step.stepId, decision.outcome, decision.reason);

        if (decision.outcome === 'abort') {
          shouldAbort = true;
        } else if (decision.outcome === 'skip') {
          coderxMetrics.recordStepSkipped(context.runId);
          tasksSkipped++;
        }
      }
    }
  }

  return { outputs, tasksFailed, tasksSkipped, shouldAbort };
}

function skipTask(
  task:    CodingTask,
  runId:   string,
  outputs: CodingTaskOutput[],
): void {
  const stepId = generateStepId();
  markSkipped(stepId);
  outputs.push({
    taskId:   task.taskId,
    kind:     task.kind,
    ok:       false,
    error:    'Skipped — prior step aborted execution.',
    attempts: 0,
  });
  coderxMetrics.recordStepSkipped(runId);
}
