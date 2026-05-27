/**
 * task-executor.ts
 * Executes a single planned task.
 *
 * Strategy (in priority order):
 * 1. LLM tool loop  — if OPENROUTER_API_KEY / AI_INTEGRATIONS_OPENROUTER_API_KEY is set
 * 2. Static step runner — deterministic fallback via interpretTask → runStep
 */

import type { PlanTask, TaskExecutionResult } from '../types/executor.types.ts';
import { interpretTask }       from '../planning/task-interpreter.ts';
import { runStep }             from './step-runner.ts';
import { executionHistory }    from './execution-history.ts';
import { runtimeMonitor }      from '../runtime/runtime-monitor.ts';
import { retryHandler }        from '../recovery/retry-handler.ts';
import { failureRecovery }     from '../recovery/failure-recovery.ts';
import { emitStepStarted, emitStepCompleted } from '../events/executor-events.ts';
import { executorLogger }      from '../telemetry/executor-logger.ts';
import { elapsedMs }           from '../utils/execution-helpers.ts';
import { runToolLoop }         from '../llm/tool-loop.ts';
import { isLLMAvailable }      from '../llm/llm-client.ts';
import { executionMemory }     from '../memory/execution-memory.ts';
import { failureMemory }       from '../memory/failure-memory.ts';

const LLM_ELIGIBLE_CATEGORIES = new Set([
  'setup', 'schema', 'api', 'auth', 'ui', 'test', 'deploy',
]);

export async function executeTask(
  task:      PlanTask,
  runId:     string,
  projectId: string,
): Promise<TaskExecutionResult> {
  const startedAt = new Date();

  executorLogger.info(runId, `Task started: ${task.id} — ${task.title}`, {
    category: task.category,
    llmMode:  isLLMAvailable() && LLM_ELIGIBLE_CATEGORIES.has(task.category),
  });

  // ── LLM Tool Loop ──────────────────────────────────────────────────────────
  if (isLLMAvailable() && LLM_ELIGIBLE_CATEGORIES.has(task.category)) {
    return executeWithLLM(task, runId, projectId, startedAt);
  }

  // ── Static Step Runner (fallback) ─────────────────────────────────────────
  return executeWithStaticSteps(task, runId, projectId, startedAt);
}

// ── LLM path ─────────────────────────────────────────────────────────────────

async function executeWithLLM(
  task:      PlanTask,
  runId:     string,
  projectId: string,
  startedAt: Date,
): Promise<TaskExecutionResult> {
  executorLogger.info(runId, `[llm-loop] Task ${task.id}: starting autonomous execution`);

  const loopResult = await runToolLoop(task, runId, projectId);

  const durationMs = elapsedMs(startedAt);

  executionMemory.record(runId, {
    taskId:     task.id,
    title:      task.title,
    status:     loopResult.ok ? 'completed' : 'failed',
    artifacts:  loopResult.artifacts,
    summary:    loopResult.summary,
    durationMs,
  });

  if (!loopResult.ok) {
    failureMemory.record(runId, task.id, loopResult.summary);
  }

  executorLogger.info(runId, `[llm-loop] Task ${task.id} done`, {
    stopReason:  loopResult.stopReason,
    iterations:  loopResult.iterations,
    success:     loopResult.ok,
    durationMs,
  });

  return {
    taskId:    task.id,
    success:   loopResult.ok,
    durationMs,
    stepsRun:  loopResult.iterations,
    artifacts: loopResult.artifacts,
    error:     loopResult.ok ? undefined : loopResult.summary,
  };
}

// ── Static path ───────────────────────────────────────────────────────────────

async function executeWithStaticSteps(
  task:      PlanTask,
  runId:     string,
  projectId: string,
  startedAt: Date,
): Promise<TaskExecutionResult> {
  const steps      = interpretTask(task);
  const artifacts: string[] = [];
  let   stepsRun   = 0;

  executorLogger.info(runId, `[static] Task ${task.id} — ${steps.length} steps`);

  for (const step of steps) {
    emitStepStarted(runId, task.id, step.id, step.type, step.label);
    stepsRun++;

    const result = await retryHandler.withRetry(
      step.id, runId,
      () => runStep(step, runId, projectId),
      { maxAttempts: 2 },
    ).catch((err) => ({
      stepId:     step.id,
      success:    false as const,
      durationMs: 0,
      error:      err instanceof Error ? err.message : String(err),
    }));

    executionHistory.record(runId, task.id, result, step.type);
    runtimeMonitor.recordStep(runId, result.success);
    emitStepCompleted(runId, task.id, step.id, step.type, result.success, result.durationMs, result.filePath);

    if (result.filePath) artifacts.push(result.filePath);

    if (!result.success) {
      const recovery = failureRecovery.handle(runId, task.id, result.error ?? 'step failed', 1);
      if (recovery.action === 'abort') {
        executorLogger.error(runId, `Task ${task.id} aborting on step ${step.id}`);
        return {
          taskId:    task.id,
          success:   false,
          durationMs: elapsedMs(startedAt),
          stepsRun,
          error:     result.error ?? 'Step failed',
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
    taskId:    task.id,
    success,
    durationMs: elapsedMs(startedAt),
    stepsRun,
    artifacts,
  };
}
