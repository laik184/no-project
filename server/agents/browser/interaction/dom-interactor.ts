/**
 * dom-interactor.ts
 * ONLY responsible for DOM interactions: click, fill, select on a Playwright Page.
 */

import type { Page }                       from 'playwright';
import { waitForVisible }                  from './element-finder.ts';
import {
  emitClickResult,
  emitFillResult,
  emitSelectResult,
  emitInteractionFailed,
}                                          from '../events/interaction-events.ts';
import { browserLogger }                   from '../telemetry/browser-logger.ts';
import { browserMetrics }                  from '../telemetry/browser-metrics.ts';
import { actionTrace }                     from '../telemetry/action-trace.ts';
import { elapsed, clampTimeout }           from '../utils/performance-utils.ts';

const DEFAULT_INTERACTION_TIMEOUT = 5_000;

export async function clickElement(
  page:      Page,
  runId:     string,
  selector:  string,
  timeoutMs  = DEFAULT_INTERACTION_TIMEOUT,
): Promise<boolean> {
  const startedAt = Date.now();
  const timeout   = clampTimeout(timeoutMs, 15_000, DEFAULT_INTERACTION_TIMEOUT);

  const element = await waitForVisible(page, runId, selector, timeout);
  if (!element) {
    browserMetrics.recordInteractionFailure(runId);
    emitInteractionFailed(runId, 'click', `Element not found: ${selector}`, selector);
    actionTrace.record(runId, { action: 'click', target: selector, success: false, durationMs: elapsed(startedAt) });
    return false;
  }

  try {
    await element.click({ timeout });
    emitClickResult(runId, selector, true, elapsed(startedAt));
    actionTrace.record(runId, { action: 'click', target: selector, success: true, durationMs: elapsed(startedAt) });
    browserLogger.debug(runId, `Clicked: ${selector}`);
    return true;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    browserMetrics.recordInteractionFailure(runId);
    emitClickResult(runId, selector, false, elapsed(startedAt));
    emitInteractionFailed(runId, 'click', error, selector);
    actionTrace.record(runId, { action: 'click', target: selector, success: false, durationMs: elapsed(startedAt) });
    browserLogger.error(runId, `Click failed: ${selector} — ${error}`);
    return false;
  }
}

export async function fillInput(
  page:      Page,
  runId:     string,
  selector:  string,
  value:     string,
  timeoutMs  = DEFAULT_INTERACTION_TIMEOUT,
): Promise<boolean> {
  const startedAt = Date.now();
  const timeout   = clampTimeout(timeoutMs, 15_000, DEFAULT_INTERACTION_TIMEOUT);

  const element = await waitForVisible(page, runId, selector, timeout);
  if (!element) {
    browserMetrics.recordInteractionFailure(runId);
    emitInteractionFailed(runId, 'fill', `Element not found: ${selector}`, selector);
    actionTrace.record(runId, { action: 'fill', target: selector, success: false, durationMs: elapsed(startedAt) });
    return false;
  }

  try {
    await element.fill(value, { timeout });
    emitFillResult(runId, selector, true, elapsed(startedAt));
    actionTrace.record(runId, { action: 'fill', target: selector, value, success: true, durationMs: elapsed(startedAt) });
    browserLogger.debug(runId, `Filled: ${selector}`);
    return true;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    browserMetrics.recordInteractionFailure(runId);
    emitFillResult(runId, selector, false, elapsed(startedAt));
    emitInteractionFailed(runId, 'fill', error, selector);
    actionTrace.record(runId, { action: 'fill', target: selector, success: false, durationMs: elapsed(startedAt) });
    browserLogger.error(runId, `Fill failed: ${selector} — ${error}`);
    return false;
  }
}

export async function selectOption(
  page:      Page,
  runId:     string,
  selector:  string,
  value:     string,
  timeoutMs  = DEFAULT_INTERACTION_TIMEOUT,
): Promise<boolean> {
  const startedAt = Date.now();
  const timeout   = clampTimeout(timeoutMs, 15_000, DEFAULT_INTERACTION_TIMEOUT);

  const element = await waitForVisible(page, runId, selector, timeout);
  if (!element) {
    browserMetrics.recordInteractionFailure(runId);
    emitInteractionFailed(runId, 'select', `Element not found: ${selector}`, selector);
    return false;
  }

  try {
    await element.selectOption(value, { timeout });
    emitSelectResult(runId, selector, value, true);
    actionTrace.record(runId, { action: 'select', target: selector, value, success: true, durationMs: elapsed(startedAt) });
    browserLogger.debug(runId, `Selected: ${selector} = ${value}`);
    return true;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    browserMetrics.recordInteractionFailure(runId);
    emitSelectResult(runId, selector, value, false);
    emitInteractionFailed(runId, 'select', error, selector);
    actionTrace.record(runId, { action: 'select', target: selector, success: false, durationMs: elapsed(startedAt) });
    browserLogger.error(runId, `Select failed: ${selector} — ${error}`);
    return false;
  }
}
