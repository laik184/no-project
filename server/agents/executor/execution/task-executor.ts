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
import { executeTool }            from '../coordination/dispatcher-client.ts';
import { toToolContext }          from '../core/executor-context.ts';

// ── File persistence ──────────────────────────────────────────────────────────

/**
 * After a coding tool succeeds it returns a file map: { relPath: code }.
 * This helper writes each entry to disk via the fs_write_file tool so the
 * generated code actually lands in the sandbox project workspace.
 */
async function persistGeneratedFiles(
  output:      unknown,
  sandboxRoot: string,
  ctx:         ReturnType<typeof toToolContext>,
): Promise<void> {
  const files = (output as Record<string, unknown> | null)?.files;
  if (!files || typeof files !== 'object') return;

  for (const [relPath, content] of Object.entries(files as Record<string, unknown>)) {
    if (typeof content !== 'string') continue;
    const absPath = `${sandboxRoot}/${relPath.replace(/^\/+/, '')}`;
    const writeResult = await executeTool('fs_write_file', { path: absPath, content }, ctx);
    if (!writeResult.ok) {
      console.error(`[task-executor] Failed to persist ${relPath}: ${writeResult.error}`);
    }
  }
}

// ── Task executor ─────────────────────────────────────────────────────────────

/**
 * Execute a single task:
 *   build step → register in state → run via step-runner → return TaskOutput.
 * For coding tasks that succeed, generated files are written to disk immediately.
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

  // Persist generated files to sandbox after a successful coding task
  if (result.ok && task.kind === 'coding') {
    await persistGeneratedFiles(
      result.output,
      context.sandboxRoot,
      toToolContext(context),
    ).catch((err) => console.error('[task-executor] File persistence error:', err));
  }

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
