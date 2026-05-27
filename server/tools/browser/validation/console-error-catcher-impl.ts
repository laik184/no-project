/**
 * console-error-catcher.ts
 * ONLY responsible for capturing browser console errors from a Playwright Page.
 * Captures: console.error, network failures, uncaught exceptions, hydration errors.
 */

import type { Page, ConsoleMessage, Request, Response } from 'playwright';
import type { ConsoleError, ConsoleErrorType }           from '../../../agents/browser/types/validation.types.ts';
import { browserMetrics }                                from '../../../agents/browser/telemetry/browser-metrics.ts';
import { browserLogger }                                 from '../../../agents/browser/telemetry/browser-logger.ts';

const HYDRATION_PATTERNS = [
  'Hydration failed',
  'hydration mismatch',
  'Text content does not match',
  'did not match server-rendered HTML',
];

const IGNORED_PATTERNS = [
  'favicon.ico',
  '[vite] connecting',
  '[vite] connected',
  'Download the React DevTools',
];

function isIgnored(message: string): boolean {
  return IGNORED_PATTERNS.some((p) => message.includes(p));
}

function classifyConsoleMessage(msg: ConsoleMessage): ConsoleErrorType | null {
  const type = msg.type();
  if (type === 'error')   return 'error';
  if (type === 'warning') return 'warning';
  return null;
}

export function attachConsoleErrorCatcher(
  page:     Page,
  runId:    string,
  collect:  ConsoleError[],
): void {
  page.on('console', (msg) => {
    const errorType = classifyConsoleMessage(msg);
    if (!errorType) return;

    const text = msg.text();
    if (isIgnored(text)) return;

    const isHydration = HYDRATION_PATTERNS.some((p) => text.includes(p));
    const type: ConsoleErrorType = isHydration ? 'hydration' : errorType;

    const entry: ConsoleError = {
      type,
      message:   text,
      source:    msg.location().url,
      timestamp: Date.now(),
    };

    collect.push(entry);
    browserMetrics.recordConsoleError(runId);
    browserLogger.warn(runId, `Console ${type}: ${text.slice(0, 120)}`);
  });

  page.on('pageerror', (err) => {
    collect.push({
      type:      'exception',
      message:   err.message,
      timestamp: Date.now(),
    });
    browserMetrics.recordConsoleError(runId);
    browserLogger.error(runId, `Uncaught exception: ${err.message}`);
  });

  page.on('requestfailed', (req: Request) => {
    const url = req.url();
    if (isIgnored(url)) return;
    collect.push({
      type:      'network',
      message:   `Request failed: ${req.method()} ${url}`,
      url,
      timestamp: Date.now(),
    });
    browserMetrics.recordConsoleError(runId);
    browserLogger.warn(runId, `Network failure: ${url}`);
  });
}

export function getErrorSummary(errors: ConsoleError[]): Record<ConsoleErrorType, number> {
  const counts: Record<ConsoleErrorType, number> = {
    error: 0, warning: 0, exception: 0, network: 0, hydration: 0,
  };
  for (const e of errors) counts[e.type]++;
  return counts;
}
