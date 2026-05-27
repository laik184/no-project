/**
 * performance-tracker.ts
 * ONLY responsible for collecting performance timing from a Playwright Page.
 */

import type { Page }                   from 'playwright';
import type { PerformanceValidation }  from '../types/validation.types.ts';
import type { PerformanceSummary }     from '../types/reporting.types.ts';
import {
  PERF_THRESHOLDS,
  isWithinLoadThreshold,
  formatMs,
}                                      from '../utils/performance-utils.ts';
import { browserLogger }               from '../telemetry/browser-logger.ts';

interface RawNavigationTiming {
  loadEventEnd:          number;
  navigationStart:       number;
  domContentLoadedEventEnd: number;
  responseStart:         number;
  responseEnd:           number;
}

export async function collectPerformanceTiming(
  page:  Page,
  runId: string,
): Promise<PerformanceSummary> {
  try {
    const timing = await page.evaluate((): RawNavigationTiming => {
      const t = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (!t) {
        return {
          loadEventEnd:             performance.timing?.loadEventEnd ?? 0,
          navigationStart:          performance.timing?.navigationStart ?? 0,
          domContentLoadedEventEnd: performance.timing?.domContentLoadedEventEnd ?? 0,
          responseStart:            performance.timing?.responseStart ?? 0,
          responseEnd:              performance.timing?.responseEnd ?? 0,
        };
      }
      return {
        loadEventEnd:             t.loadEventEnd,
        navigationStart:          0,
        domContentLoadedEventEnd: t.domContentLoadedEventEnd,
        responseStart:            t.responseStart,
        responseEnd:              t.responseEnd,
      };
    });

    const loadTimeMs = Math.round(
      timing.navigationStart
        ? timing.loadEventEnd - timing.navigationStart
        : timing.loadEventEnd,
    );

    const renderTimeMs = Math.round(timing.domContentLoadedEventEnd);

    browserLogger.debug(runId, `Performance timing collected`, {
      loadTimeMs, renderTimeMs,
    });

    return { loadTimeMs, renderTimeMs };
  } catch (err) {
    browserLogger.warn(runId, `Performance timing collection failed: ${err instanceof Error ? err.message : String(err)}`);
    return {};
  }
}

export async function validatePerformance(
  page:        Page,
  runId:       string,
  thresholdMs = PERF_THRESHOLDS.LOAD_TIME_FAIL_MS,
): Promise<PerformanceValidation> {
  const perf        = await collectPerformanceTiming(page, runId);
  const loadTimeMs  = perf.loadTimeMs ?? 0;
  const withinThreshold = isWithinLoadThreshold(loadTimeMs);

  if (!withinThreshold) {
    browserLogger.warn(runId, `Slow page load: ${formatMs(loadTimeMs)} (threshold: ${formatMs(thresholdMs)})`);
  }

  return {
    ok:              withinThreshold,
    loadTimeMs,
    renderTimeMs:    perf.renderTimeMs,
    thresholdMs,
    withinThreshold,
  };
}
