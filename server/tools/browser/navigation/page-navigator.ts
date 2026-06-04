/**
 * page-navigator.ts
 * ONLY responsible for URL navigation on a Playwright Page.
 * Detects blank pages, load failures, and infinite loading.
 */

import type { Page }                                   from 'playwright';
import type { NavigationResult }                       from '../../../shared/browser/types/navigation.types.ts';
import { isAllowedUrl, normalizeUrl, isBlankPage }    from '../../../shared/browser/utils/navigation-utils.ts';
import { emitNavigationStarted, emitNavigationCompleted,
         emitNavigationFailed }                        from '../../../shared/browser/events/navigation-events.ts';
import { browserLogger }                               from '../../../shared/browser/telemetry/browser-logger.ts';
import { actionTrace }                                 from '../../../shared/browser/telemetry/action-trace.ts';
import { elapsed }                                     from '../../../shared/browser/utils/performance-utils.ts';

const NAV_TIMEOUT_MS    = 20_000;
const WAIT_STATE        = 'domcontentloaded' as const;

export async function navigateToUrl(
  page:          Page,
  runId:         string,
  rawUrl:        string,
  allowedHosts:  string[] = [],
  timeoutMs      = NAV_TIMEOUT_MS,
): Promise<NavigationResult> {
  const url       = normalizeUrl(rawUrl);
  const startedAt = Date.now();

  emitNavigationStarted(runId, url);

  if (!isAllowedUrl(url, allowedHosts)) {
    const error = `URL blocked by security policy: ${url}`;
    browserLogger.error(runId, error);
    emitNavigationFailed(runId, url, error);
    actionTrace.record(runId, { action: 'navigate', target: url, success: false, durationMs: 0 });
    return { ok: false, url, status: 'blocked', durationMs: 0, error };
  }

  let httpStatus: number | undefined;

  try {
    const response = await page.goto(url, {
      waitUntil: WAIT_STATE,
      timeout:   timeoutMs,
    });

    httpStatus = response?.status() ?? undefined;
    const durationMs = elapsed(startedAt);

    if (httpStatus !== undefined && httpStatus >= 400) {
      const error = `HTTP ${httpStatus}`;
      emitNavigationFailed(runId, url, error);
      browserLogger.warn(runId, `Navigation error: ${error}`, { url, durationMs });
      actionTrace.record(runId, { action: 'navigate', target: url, success: false, durationMs });
      return { ok: false, url, status: 'error', httpStatus, durationMs, error };
    }

    const title    = await page.title().catch(() => '');
    const bodyText = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');

    if (isBlankPage(title, bodyText)) {
      emitNavigationFailed(runId, url, 'Blank page detected');
      browserLogger.warn(runId, `Blank page at ${url}`);
      actionTrace.record(runId, { action: 'navigate', target: url, success: false, durationMs });
      return { ok: false, url, status: 'blank', httpStatus, durationMs, title };
    }

    emitNavigationCompleted(runId, url, durationMs, true);
    browserLogger.info(runId, `Navigated to ${url}`, { durationMs, title, httpStatus });
    actionTrace.record(runId, { action: 'navigate', target: url, success: true, durationMs });
    return { ok: true, url, status: 'loaded', httpStatus, durationMs, title };
  } catch (err) {
    const durationMs = elapsed(startedAt);
    const error      = err instanceof Error ? err.message : String(err);
    const status     = error.includes('Timeout') ? 'timeout' : 'error';

    emitNavigationFailed(runId, url, error);
    browserLogger.error(runId, `Navigation failed: ${error}`, { url, durationMs });
    actionTrace.record(runId, { action: 'navigate', target: url, success: false, durationMs });
    return { ok: false, url, status, durationMs, error };
  }
}

export async function reloadPage(page: Page, runId: string): Promise<boolean> {
  try {
    await page.reload({ waitUntil: WAIT_STATE, timeout: NAV_TIMEOUT_MS });
    browserLogger.info(runId, `Page reloaded: ${page.url()}`);
    return true;
  } catch (err) {
    browserLogger.error(runId, `Reload failed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

export async function waitForLoad(page: Page, runId: string, timeoutMs = 10_000): Promise<boolean> {
  try {
    await page.waitForLoadState('load', { timeout: timeoutMs });
    return true;
  } catch {
    browserLogger.warn(runId, `waitForLoad timed out after ${timeoutMs}ms`);
    return false;
  }
}
