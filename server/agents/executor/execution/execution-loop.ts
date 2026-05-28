/**
 * server/agents/executor/execution/execution-loop.ts
 *
 * MAIN execution runtime loop.
 * Controls task lifecycle, sequencing, retries, and result aggregation.
 * No direct dispatch — delegates to task-executor for each task.
 */

import type {
  ExecutionTask,
  ExecutorAgentResult,
  ExecutorExecutionContext,
  ExecutorLoopOptions,
  TaskOutput,
} from '../types/executor.types.ts';
import { executeTask }          from './task-executor.ts';
import { DEFAULT_RETRY_CONFIG } from './retry-manager.ts';
import { executionMonitor }     from '../monitoring/execution-monitor.ts';
import { executorLogger }       from '../telemetry/executor-logger.ts';
import { executorMetrics }      from '../telemetry/executor-metrics.ts';
import { elapsedMs }            from '../utils/execution-utils.ts';

// ── Main loop ─────────────────────────────────────────────────────────────────

/**
 * Run the executor task loop.
 * Processes tasks sequentially, collects outputs, returns aggregated result.
 * Never throws — errors are captured in the result envelope.
 */
export async function runExecutionLoop(
  tasks:   ExecutionTask[],
  context: ExecutorExecutionContext,
  options: ExecutorLoopOptions = {},
): Promise<ExecutorAgentResult> {
  const { stopOnFailure = false, retry = DEFAULT_RETRY_CONFIG } = options;
  const startedAt = new Date();

  executorMetrics.recordSessionStarted();
  executionMonitor.setStatus(context.runId, 'running');
  executorLogger.sessionStarted(context.runId, context.sessionId, tasks.length);

  const outputs:      TaskOutput[] = [];
  let tasksCompleted  = 0;
  let tasksFailed     = 0;

  for (const task of tasks) {
    // Respect abort signal
    if (context.signal?.aborted) {
      executorLogger.warn(
        context.runId,
        `Loop aborted by signal after ${tasksCompleted} task(s)`,
        { sessionId: context.sessionId },
      );
      break;
    }

    // Detect stuck execution
    if (executionMonitor.isStuck(context.runId)) {
      executorLogger.warn(context.runId, `Stuck execution detected — halting loop`, {
        sessionId: context.sessionId,
      });
      break;
    }

    const output = await executeTask(task, context, retry);
    outputs.push(output);

    if (output.ok) {
      tasksCompleted++;
    } else {
      tasksFailed++;
      executorLogger.warn(
        context.runId,
        `Task ${task.taskId} failed — ${stopOnFailure ? 'stopping' : 'continuing'}`,
        { error: output.error, kind: task.kind },
      );

      // Skip optional tasks' failure count
      if (!task.optional && stopOnFailure) break;
    }
  }

  const durationMs = elapsedMs(startedAt);
  const ok         = tasksFailed === 0;

  executionMonitor.setStatus(context.runId, ok ? 'completed' : 'failed');
  executorLogger.sessionCompleted(context.runId, context.sessionId, tasksCompleted, tasksFailed, durationMs);

  return {
    ok,
    runId:          context.runId,
    sessionId:      context.sessionId,
    tasksTotal:     tasks.length,
    tasksCompleted,
    tasksFailed,
    durationMs,
    outputs,
    error: ok ? undefined : `${tasksFailed} task(s) failed`,
  };
}
