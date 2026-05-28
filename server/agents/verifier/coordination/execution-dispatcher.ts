/**
 * coordination/execution-dispatcher.ts
 * Batch dispatcher: resolves an ExecutionStep into a dispatcher-client call.
 * Converts step definitions into actual tool invocations.
 */

import { dispatchTool, resultErrorOrUndefined } from './dispatcher-client.ts';
import type { ToolExecutionContext } from '../../../tools/registry/tool-types.ts';
import type { ExecutionStep, StepResult } from '../types/execution.types.ts';
import { makeStepResult } from '../utils/execution-utils.ts';
import { eventPublisher } from '../events/event-publisher.ts';

export async function executeStep(
  step:    ExecutionStep,
  context: ToolExecutionContext,
): Promise<StepResult> {
  const start = Date.now();

  eventPublisher.stepDispatched(context.runId, step.toolName, step.phase);

  const result = await dispatchTool(
    step.toolName,
    { ...step.input },
    context,
    { phase: step.phase, timeoutMs: step.timeoutMs },
  );

  const durationMs = Date.now() - start;
  const passed     = result.ok;
  const errMsg     = resultErrorOrUndefined(result);

  if (passed) {
    eventPublisher.stepCompleted(context.runId, step.toolName, step.phase, durationMs);
    return makeStepResult(step.id, step.toolName, true, durationMs, {
      data:     (result as { ok: true; data: unknown; durationMs: number }).data,
      attempts: 1,
    });
  }

  eventPublisher.stepFailed(context.runId, step.toolName, step.phase, errMsg ?? 'unknown error');
  return makeStepResult(step.id, step.toolName, false, durationMs, {
    errors:   errMsg ? [errMsg] : [],
    attempts: 1,
  });
}

export async function executeSteps(
  steps:   ExecutionStep[],
  context: ToolExecutionContext,
  sequential = true,
): Promise<StepResult[]> {
  if (sequential) {
    const results: StepResult[] = [];
    for (const step of steps) {
      const result = await executeStep(step, context);
      results.push(result);
      if (!result.passed && step.required) break;
    }
    return results;
  }

  return Promise.all(steps.map((s) => executeStep(s, context)));
}

export function extractErrors(results: StepResult[]): string[] {
  return results.flatMap((r) => r.errors);
}

export function extractWarnings(results: StepResult[]): string[] {
  return results.flatMap((r) => r.warnings);
}

export function allStepsPassed(results: StepResult[]): boolean {
  return results.every((r) => r.passed);
}
