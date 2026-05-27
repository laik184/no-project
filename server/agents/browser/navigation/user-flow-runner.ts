/**
 * user-flow-runner.ts
 * ONLY responsible for executing end-to-end user flows step by step.
 */

import type { Page }                   from 'playwright';
import type { FlowStep, FlowResult,
              FlowStepResult }          from '../types/navigation.types.ts';
import { navigateToUrl }               from './page-navigator.ts';
import { clickElement, fillInput,
         selectOption }                from '../interaction/dom-interactor.ts';
import { waitForElement }              from '../interaction/element-finder.ts';
import {
  emitFlowStarted, emitFlowCompleted,
  emitFlowStepCompleted,
}                                      from '../events/navigation-events.ts';
import { browserLogger }               from '../telemetry/browser-logger.ts';
import { browserMetrics }              from '../telemetry/browser-metrics.ts';
import { elapsed, clampTimeout }       from '../utils/performance-utils.ts';
import { takeScreenshot }              from '../capture/screenshot-taker.ts';

const DEFAULT_STEP_TIMEOUT_MS = 8_000;

async function executeStep(
  page:      Page,
  runId:     string,
  sessionId: string,
  step:      FlowStep,
): Promise<FlowStepResult> {
  const stepStart  = Date.now();
  const timeoutMs  = clampTimeout(step.timeoutMs, 20_000, DEFAULT_STEP_TIMEOUT_MS);

  try {
    switch (step.action) {
      case 'navigate': {
        const nav = await navigateToUrl(page, runId, step.url ?? '', [], timeoutMs);
        return { label: step.label, action: step.action, success: nav.ok, durationMs: elapsed(stepStart), error: nav.error };
      }
      case 'click': {
        const ok = await clickElement(page, runId, step.selector ?? '', timeoutMs);
        return { label: step.label, action: step.action, success: ok, durationMs: elapsed(stepStart) };
      }
      case 'fill': {
        const ok = await fillInput(page, runId, step.selector ?? '', step.value ?? '', timeoutMs);
        return { label: step.label, action: step.action, success: ok, durationMs: elapsed(stepStart) };
      }
      case 'select': {
        const ok = await selectOption(page, runId, step.selector ?? '', step.value ?? '', timeoutMs);
        return { label: step.label, action: step.action, success: ok, durationMs: elapsed(stepStart) };
      }
      case 'wait': {
        const found = step.selector
          ? await waitForElement(page, runId, step.selector, timeoutMs)
          : (await page.waitForTimeout(timeoutMs).then(() => true).catch(() => false));
        return { label: step.label, action: step.action, success: !!found, durationMs: elapsed(stepStart) };
      }
      case 'assert': {
        if (!step.selector) return { label: step.label, action: step.action, success: false, durationMs: elapsed(stepStart), error: 'No selector for assert' };
        const found = await waitForElement(page, runId, step.selector, timeoutMs);
        return { label: step.label, action: step.action, success: !!found, durationMs: elapsed(stepStart), error: found ? undefined : `Element not found: ${step.selector}` };
      }
      case 'screenshot': {
        const meta = await takeScreenshot(page, runId, sessionId, step.label);
        return { label: step.label, action: step.action, success: !!meta, durationMs: elapsed(stepStart) };
      }
      default:
        return { label: step.label, action: step.action, success: false, durationMs: elapsed(stepStart), error: `Unknown action: ${step.action}` };
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { label: step.label, action: step.action, success: false, durationMs: elapsed(stepStart), error };
  }
}

export async function runUserFlow(
  page:      Page,
  runId:     string,
  sessionId: string,
  flowName:  string,
  steps:     FlowStep[],
): Promise<FlowResult> {
  const flowStart = Date.now();
  const results:  FlowStepResult[] = [];

  emitFlowStarted(runId, flowName, steps.length);
  browserMetrics.recordFlow(runId);
  browserLogger.info(runId, `Flow started: ${flowName}`, { stepsTotal: steps.length });

  for (const step of steps) {
    const result = await executeStep(page, runId, sessionId, step);
    results.push(result);
    emitFlowStepCompleted(runId, flowName, step.label, result.success, result.durationMs);

    if (!result.success && !step.optional) {
      const durationMs = elapsed(flowStart);
      emitFlowCompleted(runId, flowName, false, durationMs);
      browserLogger.error(runId, `Flow failed at step: ${step.label}`, { error: result.error });
      return {
        ok: false, flowName,
        stepsTotal: steps.length,
        stepsCompleted: results.filter((r) => r.success).length,
        steps: results,
        failedStep: step.label,
        durationMs,
        error: result.error,
      };
    }
  }

  const durationMs       = elapsed(flowStart);
  const stepsCompleted   = results.filter((r) => r.success).length;
  const ok               = stepsCompleted === steps.length || steps.every((s, i) => s.optional || results[i]?.success);

  emitFlowCompleted(runId, flowName, ok, durationMs);
  browserLogger.info(runId, `Flow ${ok ? 'passed' : 'failed'}: ${flowName}`, { stepsCompleted, durationMs });
  return { ok, flowName, stepsTotal: steps.length, stepsCompleted, steps: results, durationMs };
}
