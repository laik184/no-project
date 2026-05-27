/**
 * navigation-engine.ts
 * ONLY responsible for coordinating the navigation workflow:
 * attach error catchers → navigate → screenshot → validate → collect metrics.
 */

import type { Page }                     from 'playwright';
import type { NavigationResult }         from '../types/navigation.types.ts';
import type { UIValidationResult }       from '../types/validation.types.ts';
import type { ConsoleError }             from '../types/validation.types.ts';
import type { ScreenshotMeta }           from '../types/reporting.types.ts';
import { navigateToUrl }                 from '../../../tools/browser/navigation/page-navigator.ts';
import { takeScreenshot }                from '../../../tools/browser/capture/screenshot-taker.ts';
import { detectCrash, attachCrashListener } from '../../../tools/browser/capture/crash-detector.ts';
import { attachConsoleErrorCatcher }     from '../../../tools/browser/validation/console-error-catcher-impl.ts';
import { validateUI }                    from '../../../tools/browser/validation/ui-validator.ts';
import { capturePageMetrics }            from '../../../tools/browser/monitoring/performance-metrics.ts';
import { isAllowedUrl }                  from '../utils/navigation-utils.ts';
import { browserLogger }                 from '../telemetry/browser-logger.ts';

export interface NavigationEngineResult {
  navigation:    NavigationResult;
  validation:    UIValidationResult;
  screenshots:   ScreenshotMeta[];
  consoleErrors: ConsoleError[];
}

export async function runNavigationWorkflow(
  page:         Page,
  runId:        string,
  sessionId:    string,
  url:          string,
  allowedHosts: string[] = [],
): Promise<NavigationEngineResult> {
  const consoleErrors: ConsoleError[] = [];
  const screenshots:   ScreenshotMeta[] = [];
  const startMs = Date.now();

  // 1 — Security gate
  if (!isAllowedUrl(url, allowedHosts)) {
    browserLogger.error(runId, `URL blocked: ${url}`);
    const blocked: NavigationResult = { ok: false, url, status: 'blocked', durationMs: 0, error: 'URL not allowed' };
    const emptyValidation: UIValidationResult = { ok: false, url, checks: [], consoleErrors: [], crashDetected: false, durationMs: 0 };
    return { navigation: blocked, validation: emptyValidation, screenshots, consoleErrors };
  }

  // 2 — Attach console error collector and crash listener before navigating
  attachConsoleErrorCatcher(page, runId, consoleErrors);

  let latestCrash = false;
  attachCrashListener(page, runId, () => { latestCrash = true; });

  // 3 — Navigate
  const navigation = await navigateToUrl(page, runId, url, allowedHosts);

  // 4 — Initial screenshot (regardless of nav success — useful for debugging)
  const initial = await takeScreenshot(page, runId, sessionId, 'initial');
  if (initial) screenshots.push(initial);

  // 5 — Crash detection
  const crash    = await detectCrash(page, runId);
  const crashed  = crash.crashed || latestCrash;

  // 6 — UI validation (fail-closed: only passes if all error checks pass)
  const validation = await validateUI(page, runId, sessionId, consoleErrors, startMs);
  validation.crashDetected = crashed;
  if (crashed) validation.ok = false;

  // 7 — Collect performance metrics
  await capturePageMetrics(page, runId);

  // 8 — Post-validation screenshot
  const final = await takeScreenshot(page, runId, sessionId, 'post-validation');
  if (final) screenshots.push(final);

  browserLogger.info(runId, `Navigation workflow complete`, {
    url, navOk: navigation.ok, validationOk: validation.ok, crashed,
    screenshots: screenshots.length, consoleErrors: consoleErrors.length,
  });

  return { navigation, validation, screenshots, consoleErrors };
}
