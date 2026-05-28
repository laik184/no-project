/**
 * execution/step-runner.ts
 * Runs a single ExecutionStep with retry orchestration.
 * Delegates all actual work to dispatcher-client.
 */

import type { ExecutionStep, StepResult } from '../types/execution.types.ts';
import type { ToolExecutionContext } from '../../../tools/registry/tool-types.ts';
import { dispatchTool, resultErrorOrUndefined } from '../coordination/dispatcher-client.ts';
import { makeStepResult } from '../utils/execution-utils.ts';
import { withRetry, type RetryContext } from './retry-manager.ts';
import { verifierLogger } from '../telemetry/verifier-logger.ts';
import { executionHistory } from '../state/execution-history.ts';

export async function runStep(
  step:    ExecutionStep,
  context: ToolExecutionContext,
): Promise<StepResult> {
  const start  = Date.now();
  const retryCtx: RetryContext = {
    runId:    context.runId,
    toolName: step.toolName,
    phase:    step.phase,
  };

  const { result: dispatchResult, attempts } = await withRetry(
    (attempt) => dispatchTool(step.toolName, step.input, context, {
      phase:     step.phase,
      timeoutMs: step.timeoutMs,
      attempt,
    }),
    retryCtx,
    step.retryPolicy,
    (r) => r.ok,
    (r) => { const e = resultErrorOrUndefined(r); return e ?? ''; },
  );

  const durationMs = Date.now() - start;
  const passed     = dispatchResult.ok;
  const errMsg     = resultErrorOrUndefined(dispatchResult);

  const stepResult = makeStepResult(step.id, step.toolName, passed, durationMs, {
    errors:   errMsg ? [errMsg] : [],
    attempts,
    data:     passed
      ? (dispatchResult as { ok: true; data: unknown; durationMs: number }).data
      : undefined,
  });

  executionHistory.recordStep(context.runId, stepResult);

  if (!passed) {
    verifierLogger.warn(context.runId, `Step failed after ${attempts} attempt(s): ${step.toolName}`, {
      error: errMsg,
    });
  }

  return stepResult;
}

export async function runRequiredSteps(
  steps:   ExecutionStep[],
  context: ToolExecutionContext,
): Promise<{ results: StepResult[]; aborted: boolean }> {
  const results: StepResult[] = [];

  for (const step of steps) {
    const result = await runStep(step, context);
    results.push(result);

    if (!result.passed && step.required) {
      verifierLogger.error(context.runId, `Required step failed — aborting phase`, {
        toolName: step.toolName,
        phase:    step.phase,
      });
      return { results, aborted: true };
    }
  }

  return { results, aborted: false };
}
