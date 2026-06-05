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
  _sandboxRoot: string,
  ctx:          ReturnType<typeof toToolContext>,
): Promise<{ written: string[]; failed: string[] }> {
  const files = (output as Record<string, unknown> | null)?.files;
  if (!files || typeof files !== 'object') return { written: [], failed: [] };

  const written: string[] = [];
  const failed:  string[] = [];

  for (const [relPath, content] of Object.entries(files as Record<string, unknown>)) {
    if (typeof content !== 'string') continue;

    // Pass the RELATIVE path — fs_write_file's resolveSafe() prepends sandboxRoot internally.
    // Passing an absolute path causes double-prefixing (sandboxRoot/tmp/nurax-sandbox/...).
    const safePath = relPath.replace(/^\/+/, '');

    const writeResult = await executeTool('fs_write_file', { path: safePath, content }, ctx);
    if (writeResult.ok) {
      written.push(safePath);
    } else {
      failed.push(safePath);
      console.error(`[task-executor] Failed to persist "${safePath}": ${writeResult.error}`);
    }
  }

  if (failed.length > 0) {
    console.error(`[task-executor] ${failed.length} file(s) failed to write: ${failed.join(', ')}`);
  } else if (written.length > 0) {
    console.log(`[task-executor] Persisted ${written.length} file(s): ${written.join(', ')}`);
  }

  return { written, failed };
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
    const persist = await persistGeneratedFiles(
      result.output,
      context.sandboxRoot,
      toToolContext(context),
    ).catch((err: unknown) => {
      console.error('[task-executor] File persistence threw unexpectedly:', err);
      return { written: [], failed: [] };
    });
    if (persist.failed.length > 0 && persist.written.length === 0) {
      // Every file failed — surface as task error so the caller knows nothing landed on disk
      console.error(`[task-executor] All ${persist.failed.length} generated file(s) failed to persist`);
    }
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
