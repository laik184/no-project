/**
 * browser-health-monitor.ts
 * ONLY responsible for monitoring browser session health.
 */

import type { Page }              from 'playwright';
import type { BrowserHealthStatus } from '../types/browser.types.ts';
import { emitBrowserCrashed }     from '../events/browser-events.ts';
import { browserLogger }          from '../telemetry/browser-logger.ts';

const HEALTH_CHECK_TIMEOUT_MS = 3_000;

export async function checkPageHealth(
  page:      Page,
  runId:     string,
  sessionId: string,
): Promise<BrowserHealthStatus> {
  const checkedAt = Date.now();

  try {
    await page.evaluate(() => true, { timeout: HEALTH_CHECK_TIMEOUT_MS } as { timeout: number });

    return {
      alive:     true,
      sessionId,
      status:    'ready',
      pagesOpen: 1,
      checkedAt,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    emitBrowserCrashed(sessionId, runId, error);
    browserLogger.error(runId, `Health check failed: ${error}`);

    return {
      alive:     false,
      sessionId,
      status:    'crashed',
      pagesOpen: 0,
      checkedAt,
      error,
    };
  }
}

export function startHealthMonitor(
  getPage:     () => Page | null,
  runId:       string,
  sessionId:   string,
  intervalMs   = 15_000,
  onUnhealthy?: (status: BrowserHealthStatus) => void,
): () => void {
  let timer: ReturnType<typeof setInterval> | null = null;

  timer = setInterval(async () => {
    const page = getPage();
    if (!page) {
      clearInterval(timer!);
      return;
    }

    const status = await checkPageHealth(page, runId, sessionId);
    if (!status.alive && onUnhealthy) {
      onUnhealthy(status);
      clearInterval(timer!);
    }
  }, intervalMs);

  return () => {
    if (timer) clearInterval(timer);
  };
}
