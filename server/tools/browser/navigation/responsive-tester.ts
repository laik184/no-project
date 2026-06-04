/**
 * responsive-tester.ts
 * ONLY responsible for testing a URL at mobile, tablet, and desktop viewports.
 */

import type { Page }                   from 'playwright';
import type { ViewportSize,
              ResponsiveTestResult }    from '../../../shared/browser/types/navigation.types.ts';
import { navigateToUrl }               from './page-navigator.ts';
import { takeScreenshot }              from '../capture/screenshot-taker.ts';
import { browserLogger }               from '../../../shared/browser/telemetry/browser-logger.ts';
import { elapsed }                     from '../../../shared/browser/utils/performance-utils.ts';

export const VIEWPORTS: ViewportSize[] = [
  { width: 375,  height: 812,  label: 'mobile'  },
  { width: 768,  height: 1024, label: 'tablet'  },
  { width: 1280, height: 800,  label: 'desktop' },
];

export async function testViewport(
  page:      Page,
  runId:     string,
  sessionId: string,
  url:       string,
  viewport:  ViewportSize,
): Promise<ResponsiveTestResult> {
  const startedAt = Date.now();

  try {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const nav = await navigateToUrl(page, runId, url);

    if (!nav.ok) {
      return {
        viewport,
        ok:        false,
        durationMs: elapsed(startedAt),
        error:      nav.error,
      };
    }

    await takeScreenshot(page, runId, sessionId, `responsive_${viewport.label}`);

    browserLogger.info(runId, `Responsive test passed: ${viewport.label}`, {
      viewport: `${viewport.width}x${viewport.height}`,
      durationMs: elapsed(startedAt),
    });

    return { viewport, ok: true, durationMs: elapsed(startedAt) };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    browserLogger.error(runId, `Responsive test failed: ${viewport.label} — ${error}`);
    return { viewport, ok: false, durationMs: elapsed(startedAt), error };
  }
}

export async function runResponsiveTests(
  page:      Page,
  runId:     string,
  sessionId: string,
  url:       string,
  viewports: ViewportSize[] = VIEWPORTS,
): Promise<ResponsiveTestResult[]> {
  browserLogger.info(runId, `Running responsive tests`, { url, viewportCount: viewports.length });
  const results: ResponsiveTestResult[] = [];

  for (const viewport of viewports) {
    const result = await testViewport(page, runId, sessionId, url, viewport);
    results.push(result);
  }

  // Restore desktop viewport after tests
  await page.setViewportSize({ width: 1280, height: 800 }).catch(() => undefined);

  const passed = results.filter((r) => r.ok).length;
  browserLogger.info(runId, `Responsive tests complete`, {
    passed, total: results.length, url,
  });

  return results;
}
