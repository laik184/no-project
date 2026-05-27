/**
 * crash-detector.ts
 * ONLY responsible for detecting frontend crashes from a Playwright Page.
 * Detects: React error boundaries, white screens, uncaught exceptions, page crashes.
 */

import type { Page } from 'playwright';
import type { CrashReport, CrashType } from '../../../agents/browser/types/validation.types.ts';
import { browserLogger }                from '../../../agents/browser/telemetry/browser-logger.ts';
import { browserMetrics }               from '../../../agents/browser/telemetry/browser-metrics.ts';

const REACT_ERROR_PATTERNS = [
  'The above error occurred in',
  'React will try to recreate this component tree',
  'Uncaught Error:',
  'Uncaught TypeError:',
  'Cannot read properties of undefined',
  'Cannot read property',
];

const WHITE_SCREEN_THRESHOLD_BYTES = 200;

export async function detectCrash(page: Page, runId: string): Promise<CrashReport> {
  const url = page.url();
  const now = Date.now();

  // 1 — check for page crash (Playwright-level)
  let isCrashed = false;
  try {
    await page.evaluate(() => true);
  } catch {
    isCrashed = true;
  }

  if (isCrashed) {
    browserMetrics.recordCrash(runId);
    browserLogger.error(runId, `Page crash detected at ${url}`);
    return { crashed: true, type: 'page-crash', url, timestamp: now };
  }

  // 2 — check for white/blank screen
  try {
    const bodyText = await page.evaluate(() => document.body?.innerText ?? '');
    const bodyHtml = await page.evaluate(() => document.body?.innerHTML ?? '');

    if (bodyHtml.trim().length < WHITE_SCREEN_THRESHOLD_BYTES) {
      browserMetrics.recordCrash(runId);
      browserLogger.warn(runId, `White screen detected at ${url}`);
      return { crashed: true, type: 'white-screen', url, timestamp: now };
    }

    // 3 — check for React error boundary text
    const combined = bodyText + bodyHtml;
    const reactErr = REACT_ERROR_PATTERNS.find((p) => combined.includes(p));
    if (reactErr) {
      browserMetrics.recordCrash(runId);
      browserLogger.error(runId, `React crash detected at ${url}`, { pattern: reactErr });
      return { crashed: true, type: 'react-error', message: reactErr, url, timestamp: now };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    browserLogger.error(runId, `Crash detection evaluation failed: ${msg}`);
    return { crashed: true, type: 'uncaught-exception', message: msg, url, timestamp: now };
  }

  return { crashed: false, url, timestamp: now };
}

export function attachCrashListener(
  page:    Page,
  runId:   string,
  onCrash: (report: CrashReport) => void,
): void {
  page.on('crash', () => {
    browserMetrics.recordCrash(runId);
    browserLogger.error(runId, `Page crash event received`);
    onCrash({ crashed: true, type: 'page-crash', url: page.url(), timestamp: Date.now() });
  });

  page.on('pageerror', (err) => {
    const type: CrashType = err.message.includes('React') ? 'react-error' : 'uncaught-exception';
    browserLogger.error(runId, `Uncaught page error: ${err.message}`);
    onCrash({ crashed: true, type, message: err.message, url: page.url(), timestamp: Date.now() });
  });
}
