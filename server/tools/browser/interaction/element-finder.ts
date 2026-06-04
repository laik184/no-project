/**
 * element-finder.ts
 * ONLY responsible for locating DOM elements on a Playwright Page.
 * All lookups include timeout handling and visibility checks.
 */

import type { Page, Locator }   from 'playwright';
import { isSafeSelector }       from '../../../shared/browser/utils/dom-utils.ts';
import { emitElementNotFound }  from '../../../shared/browser/events/interaction-events.ts';
import { browserLogger }        from '../../../shared/browser/telemetry/browser-logger.ts';

const DEFAULT_TIMEOUT_MS = 5_000;

export async function waitForElement(
  page:      Page,
  runId:     string,
  selector:  string,
  timeoutMs  = DEFAULT_TIMEOUT_MS,
): Promise<Locator | null> {
  if (!isSafeSelector(selector)) {
    browserLogger.warn(runId, `Unsafe selector rejected: ${selector}`);
    return null;
  }

  try {
    const locator = page.locator(selector).first();
    await locator.waitFor({ state: 'attached', timeout: timeoutMs });
    return locator;
  } catch {
    emitElementNotFound(runId, selector, timeoutMs);
    browserLogger.warn(runId, `Element not found: ${selector}`, { timeoutMs });
    return null;
  }
}

export async function waitForVisible(
  page:      Page,
  runId:     string,
  selector:  string,
  timeoutMs  = DEFAULT_TIMEOUT_MS,
): Promise<Locator | null> {
  if (!isSafeSelector(selector)) {
    browserLogger.warn(runId, `Unsafe selector rejected: ${selector}`);
    return null;
  }

  try {
    const locator = page.locator(selector).first();
    await locator.waitFor({ state: 'visible', timeout: timeoutMs });
    return locator;
  } catch {
    emitElementNotFound(runId, selector, timeoutMs);
    browserLogger.warn(runId, `Element not visible: ${selector}`, { timeoutMs });
    return null;
  }
}

export async function isElementPresent(
  page:     Page,
  selector: string,
): Promise<boolean> {
  if (!isSafeSelector(selector)) return false;
  try {
    return (await page.locator(selector).count()) > 0;
  } catch {
    return false;
  }
}

export async function isElementVisible(
  page:     Page,
  selector: string,
): Promise<boolean> {
  if (!isSafeSelector(selector)) return false;
  try {
    return await page.locator(selector).first().isVisible();
  } catch {
    return false;
  }
}

export async function countElements(
  page:     Page,
  selector: string,
): Promise<number> {
  if (!isSafeSelector(selector)) return 0;
  try {
    return await page.locator(selector).count();
  } catch {
    return 0;
  }
}
