/**
 * screenshot-taker.ts
 * ONLY responsible for capturing screenshots from a Playwright Page.
 */

import type { Page } from 'playwright';
import {
  buildScreenshotPath,
  getScreenshotSize,
} from '../utils/screenshot-utils.ts';
import { emitScreenshotCaptured }         from '../events/browser-events.ts';
import { browserMetrics }                  from '../telemetry/browser-metrics.ts';
import { actionTrace }                     from '../telemetry/action-trace.ts';
import { browserLogger }                   from '../telemetry/browser-logger.ts';
import type { ScreenshotMeta }             from '../types/reporting.types.ts';

export interface ScreenshotOptions {
  fullPage?: boolean;
  clip?: { x: number; y: number; width: number; height: number };
  timeoutMs?: number;
}

export async function takeScreenshot(
  page:      Page,
  runId:     string,
  sessionId: string,
  label:     string,
  opts:      ScreenshotOptions = {},
): Promise<ScreenshotMeta | null> {
  const filePath  = buildScreenshotPath(runId, label);
  const startedAt = Date.now();

  try {
    await page.screenshot({
      path:     filePath,
      fullPage: opts.fullPage ?? true,
      clip:     opts.clip,
      timeout:  opts.timeoutMs ?? 10_000,
      type:     'png',
      animations: 'disabled',
    });

    const sizeBytes = getScreenshotSize(filePath);
    const timestamp = Date.now();

    browserMetrics.recordScreenshot(runId);
    emitScreenshotCaptured(sessionId, runId, label, filePath);

    actionTrace.record(runId, {
      action:     'screenshot',
      target:     label,
      success:    true,
      durationMs: Date.now() - startedAt,
    });

    browserLogger.info(runId, `Screenshot captured: ${label}`, {
      path: filePath, sizeBytes,
    });

    return { id: `${runId}_${label}`, label, path: filePath, timestamp, sizeBytes };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    browserLogger.error(runId, `Screenshot failed: ${label} — ${error}`);
    actionTrace.record(runId, {
      action:     'screenshot',
      target:     label,
      success:    false,
      durationMs: Date.now() - startedAt,
    });
    return null;
  }
}

export async function takeElementScreenshot(
  page:      Page,
  runId:     string,
  sessionId: string,
  selector:  string,
  label:     string,
): Promise<ScreenshotMeta | null> {
  const filePath  = buildScreenshotPath(runId, label);
  const startedAt = Date.now();

  try {
    const element = await page.locator(selector).first();
    await element.screenshot({ path: filePath, type: 'png', animations: 'disabled', timeout: 8_000 });

    const sizeBytes = getScreenshotSize(filePath);
    const timestamp = Date.now();

    browserMetrics.recordScreenshot(runId);
    emitScreenshotCaptured(sessionId, runId, label, filePath);

    browserLogger.info(runId, `Element screenshot captured: ${selector}`, { label, path: filePath });

    return { id: `${runId}_${label}`, label, path: filePath, timestamp, sizeBytes };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    browserLogger.error(runId, `Element screenshot failed: ${selector} — ${error}`);
    actionTrace.record(runId, {
      action: 'screenshot', target: label, success: false, durationMs: Date.now() - startedAt,
    });
    return null;
  }
}
