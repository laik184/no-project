/**
 * ui-validator.ts
 * ONLY responsible for validating UI state on a Playwright Page.
 * Default result: FAIL — only explicitly passing checks count as success.
 */

import type { Page }                        from 'playwright';
import type { UIValidationResult, UICheck } from '../../../shared/browser/types/validation.types.ts';
import type { ConsoleError }                from '../../../shared/browser/types/validation.types.ts';
import { buildRootAppSelectors }            from '../../../shared/browser/utils/dom-utils.ts';
import { emitValidationFailed,
         emitValidationPassed }             from '../../../shared/browser/events/browser-events.ts';
import { browserLogger }                    from '../../../shared/browser/telemetry/browser-logger.ts';
import { browserMetrics }                   from '../../../shared/browser/telemetry/browser-metrics.ts';
import { elapsed }                          from '../../../shared/browser/utils/performance-utils.ts';

const ROOT_VISIBLE_TIMEOUT_MS = 5_000;

async function checkRootAppExists(page: Page): Promise<UICheck> {
  const selectors = buildRootAppSelectors();
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      await el.waitFor({ state: 'attached', timeout: ROOT_VISIBLE_TIMEOUT_MS });
      const visible = await el.isVisible();
      if (visible) {
        return { name: 'root-app-exists', passed: true, severity: 'error', detail: sel };
      }
    } catch {
      // try next selector
    }
  }
  return { name: 'root-app-exists', passed: false, severity: 'error', detail: 'No root element found' };
}

async function checkPageNotBlank(page: Page): Promise<UICheck> {
  try {
    const bodyText = await page.evaluate(() => document.body?.innerText ?? '');
    const passed   = bodyText.trim().length > 20;
    return { name: 'page-not-blank', passed, severity: 'error', detail: passed ? undefined : 'Page body appears empty' };
  } catch {
    return { name: 'page-not-blank', passed: false, severity: 'error', detail: 'Could not read page body' };
  }
}

async function checkNoLayoutBreaks(page: Page): Promise<UICheck> {
  try {
    const hasOverflow = await page.evaluate(() => {
      const body = document.body;
      return body.scrollWidth > window.innerWidth + 50;
    });
    return {
      name:   'no-horizontal-overflow',
      passed: !hasOverflow,
      severity: 'warning',
      detail: hasOverflow ? 'Horizontal overflow detected — possible layout break' : undefined,
    };
  } catch {
    return { name: 'no-horizontal-overflow', passed: true, severity: 'warning' };
  }
}

async function checkTitlePresent(page: Page): Promise<UICheck> {
  try {
    const title  = await page.title();
    const passed = title.trim().length > 0 && title !== 'about:blank';
    return { name: 'page-title-present', passed, severity: 'warning', detail: title || undefined };
  } catch {
    return { name: 'page-title-present', passed: false, severity: 'warning' };
  }
}

export async function validateUI(
  page:      Page,
  runId:     string,
  sessionId: string,
  consoleErrors: ConsoleError[],
  startMs:   number,
): Promise<UIValidationResult> {
  const url = page.url();

  const [rootCheck, blankCheck, layoutCheck, titleCheck] = await Promise.all([
    checkRootAppExists(page),
    checkPageNotBlank(page),
    checkNoLayoutBreaks(page),
    checkTitlePresent(page),
  ]);

  const checks   = [rootCheck, blankCheck, layoutCheck, titleCheck];
  const failures = checks.filter((c) => !c.passed && c.severity === 'error');
  const ok       = failures.length === 0;

  if (ok) {
    emitValidationPassed(sessionId, runId, url);
    browserLogger.info(runId, `UI validation passed`, { url });
  } else {
    for (const f of failures) {
      emitValidationFailed(sessionId, runId, url, f.detail ?? f.name);
      browserLogger.error(runId, `UI validation failed: ${f.name}`, { detail: f.detail });
    }
    browserMetrics.recordValidationFailure(runId);
  }

  return {
    ok,
    url,
    checks,
    consoleErrors,
    crashDetected: false,
    durationMs:    elapsed(startMs),
  };
}
