/**
 * state-capturer.ts
 * ONLY responsible for capturing UI state snapshots from a Playwright Page.
 * Examples: modal open, form filled, dropdown selected.
 */

import type { Page }        from 'playwright';
import { isElementVisible } from './element-finder.ts';
import { browserLogger }    from '../../../shared/browser/telemetry/browser-logger.ts';

export interface UIStateSnapshot {
  url:           string;
  title:         string;
  timestamp:     number;
  modalsOpen:    boolean;
  formFields:    FormFieldState[];
  visibleText:   string;
  inputValues:   Record<string, string>;
}

export interface FormFieldState {
  selector: string;
  value:    string;
  type:     string;
  visible:  boolean;
}

export async function captureUIState(
  page:  Page,
  runId: string,
): Promise<UIStateSnapshot> {
  const url       = page.url();
  const timestamp = Date.now();

  const title = await page.title().catch(() => '');

  const modalsOpen = await isModalOpen(page);

  const formFields = await captureFormFields(page, runId);

  const visibleText = await page.evaluate(() =>
    (document.body?.innerText ?? '').slice(0, 500),
  ).catch(() => '');

  const inputValues = await captureInputValues(page);

  browserLogger.debug(runId, `UI state captured`, {
    url, modalsOpen, fieldCount: formFields.length,
  });

  return { url, title, timestamp, modalsOpen, formFields, visibleText, inputValues };
}

async function isModalOpen(page: Page): Promise<boolean> {
  const modalSelectors = [
    '[role="dialog"]',
    '[aria-modal="true"]',
    '.modal.show',
    '.modal-open',
    '[data-testid*="modal"]',
  ];
  for (const sel of modalSelectors) {
    if (await isElementVisible(page, sel)) return true;
  }
  return false;
}

async function captureFormFields(page: Page, runId: string): Promise<FormFieldState[]> {
  try {
    return await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
      return inputs.slice(0, 20).map((el) => {
        const input = el as HTMLInputElement;
        return {
          selector: input.id ? `#${input.id}` : input.name ? `[name="${input.name}"]` : input.tagName.toLowerCase(),
          value:    input.value ?? '',
          type:     input.type ?? input.tagName.toLowerCase(),
          visible:  !!(input.offsetParent),
        };
      });
    });
  } catch {
    browserLogger.debug(runId, 'Could not capture form fields');
    return [];
  }
}

async function captureInputValues(page: Page): Promise<Record<string, string>> {
  try {
    return await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[id], input[name]'));
      const result: Record<string, string> = {};
      for (const el of inputs.slice(0, 15)) {
        const input = el as HTMLInputElement;
        const key   = input.id || input.name;
        if (key) result[key] = input.value;
      }
      return result;
    });
  } catch {
    return {};
  }
}
