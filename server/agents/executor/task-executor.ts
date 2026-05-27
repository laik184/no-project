import type { PlanTask, TaskExecutionResult } from './types.ts';
import { runStep }             from './step-runner.ts';
import { executionHistory }    from './history.ts';
import { executorLogger }      from './telemetry.ts';
import { elapsedMs }           from './utils.ts';
import { emitStepStarted, emitStepCompleted } from './events.ts';
import { runtimeMonitor }      from '../terminal/monitoring/runtime-monitor.ts';
import { runToolLoop }         from '../coderx/index.ts';

const LLM_ELIGIBLE_CATEGORIES = new Set(['setup', 'schema', 'api', 'auth', 'ui', 'test', 'deploy']);

function isLLMAvailable(): boolean {
  return !!(process.env.OPENROUTER_API_KEY || process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY);
}

function interpretTask(task: PlanTask): Array<{ id: string; type: string; label: string; timeoutMs: number; taskId: string; input: Record<string, string> }> {
  const base = { taskId: task.id, timeoutMs: 30_000, input: {} as Record<string, string> };
  const name = task.title ?? task.id;
  switch (task.category) {
    case 'ui':      return [{ ...base, id: `${task.id}-ui`,      type: 'generate_frontend', label: `Generate UI: ${name}`,      input: { name } }];
    case 'api':     return [{ ...base, id: `${task.id}-api`,     type: 'generate_api',      label: `Generate API: ${name}`,     input: { name } }];
    case 'auth':    return [{ ...base, id: `${task.id}-auth`,    type: 'generate_auth',     label: `Generate auth: ${name}`,    input: { name } }];
    case 'schema':  return [{ ...base, id: `${task.id}-schema`,  type: 'generate_database', label: `Generate schema: ${name}`,  input: { name } }];
    case 'backend': return [{ ...base, id: `${task.id}-backend`, type: 'generate_backend',  label: `Generate backend: ${name}`, input: { name } }];
    case 'setup':   return [{ ...base, id: `${task.id}-setup`,   type: 'npm_install',       label: `Install deps: ${name}`,     input: {} }];
    default:        return [{ ...base, id: `${task.id}-generic`, type: 'validate_output',   label: `Validate: ${name}`,         input: { description: name } }];
  }
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2, delayMs = 500): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try { return await fn(); } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
  throw lastErr;
}

function decideRecovery(error: string): 'retry' | 'skip' | 'abort' {
  if (/timeout|ETIMEDOUT/i.test(error))  return 'skip';
  if (/not found|ENOENT/i.test(error))   return 'skip';
  return 'abort';
}

export async function executeTask(task: PlanTask, runId: string, projectId: string): Promise<TaskExecutionResult> {
  const startedAt = new Date();
  executorLogger.info(runId, `Task started: ${task.id} — ${task.title}`, {
    category: task.category,
    llmMode:  isLLMAvailable() && LLM_ELIGIBLE_CATEGORIES.has(task.category),
  });

  if (isLLMAvailable() && LLM_ELIGIBLE_CATEGORIES.has(task.category)) {
    return executeWithLLM(task, runId, startedAt);
  }
  return executeWithStaticSteps(task, runId, projectId, startedAt);
}

async function executeWithLLM(task: PlanTask, runId: string, startedAt: Date): Promise<TaskExecutionResult> {
  executorLogger.info(runId, `[llm-loop] Task ${task.id}: starting autonomous execution`);
  try {
    const loopResult = await runToolLoop({
      task:     `${task.category}: ${task.title ?? task.description ?? task.id}`,
      basePath: process.env.AGENT_PROJECT_ROOT ?? '.sandbox',
    });
    const durationMs = elapsedMs(startedAt);
    executorLogger.info(runId, `[llm-loop] Task ${task.id} done`, { iterations: loopResult.iterations, success: loopResult.success, durationMs });
    return {
      taskId:    task.id,
      success:   loopResult.success,
      durationMs,
      stepsRun:  loopResult.iterations,
      artifacts: [],
      error:     loopResult.success ? undefined : (loopResult.error ?? 'LLM loop did not complete'),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    executorLogger.error(runId, `[llm-loop] Task ${task.id} error: ${msg}`);
    return { taskId: task.id, success: false, durationMs: elapsedMs(startedAt), stepsRun: 0, artifacts: [], error: msg };
  }
}

async function executeWithStaticSteps(task: PlanTask, runId: string, projectId: string, startedAt: Date): Promise<TaskExecutionResult> {
  const steps      = interpretTask(task);
  const artifacts: string[] = [];
  let   stepsRun   = 0;

  executorLogger.info(runId, `[static] Task ${task.id} — ${steps.length} steps`);

  for (const step of steps) {
    emitStepStarted(runId, task.id, step.id, step.type, step.label);
    stepsRun++;

    const result = await withRetry(
      () => runStep(step as any, runId, projectId),
      2,
    ).catch((err) => ({
      stepId: step.id, success: false as const, durationMs: 0,
      error: err instanceof Error ? err.message : String(err),
    }));

    executionHistory.record(runId, task.id, result, step.type);
    runtimeMonitor.recordStep(runId, result.success);
    emitStepCompleted(runId, task.id, step.id, step.type, result.success, result.durationMs, (result as any).filePath);

    if ((result as any).filePath) artifacts.push((result as any).filePath);

    if (!result.success) {
      const action = decideRecovery(result.error ?? 'step failed');
      if (action === 'abort') {
        executorLogger.error(runId, `Task ${task.id} aborting on step ${step.id}`);
        return { taskId: task.id, success: false, durationMs: elapsedMs(startedAt), stepsRun, error: result.error ?? 'Step failed', artifacts };
      }
      if (action === 'skip') {
        executorLogger.warn(runId, `Skipping failed step ${step.id} (${step.type})`);
        continue;
      }
    }

    if (!runtimeMonitor.isHealthy(runId)) {
      executorLogger.warn(runId, `High failure rate — stopping task ${task.id} early`);
      break;
    }
  }

  const success = executionHistory.countFailures(runId) === 0 || (stepsRun > 0 && artifacts.length > 0);
  executorLogger.info(runId, `Task ${task.id} done — success=${success}`, { stepsRun, artifacts: artifacts.length, durationMs: elapsedMs(startedAt) });
  return { taskId: task.id, success, durationMs: elapsedMs(startedAt), stepsRun, artifacts };
}
