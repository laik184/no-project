/**
 * server/tools/browser/interaction/click-element.ts
 * Tool: browser_click
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                        from '../../registry/tool-metadata.ts';
import { getOrOpenPage }                              from '../session/page-manager.ts';
import { clickElement }                               from './dom-interactor.ts';
import { assertSelector }                             from '../validation-core/selector-validator.ts';
import { clampInteractionTimeout }                    from '../validation-core/interaction-validator.ts';
import { browserFail }                                from '../shared/browser-result.ts';

export const browserClickTool: ToolDefinition = {
  name:        'browser_click',
  category:    'browser',
  description: 'Click an element in the active browser session by CSS/Playwright selector',
  inputSchema: {
    selector:  { type: 'string', description: 'CSS or Playwright selector', required: true  },
    timeoutMs: { type: 'number', description: 'Timeout in ms (max 15000)',   required: false },
  },
  permissions: ['network'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const { runId } = ctx;
    let selector: string;
    try {
      selector = assertSelector(input.selector);
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }
    const timeoutMs = clampInteractionTimeout(input.timeoutMs);
    try {
      const page = await getOrOpenPage(runId);
      const ok   = await clickElement(page, runId, selector, timeoutMs);
      if (!ok) return browserFail(`Click failed — element not found or not interactable: ${selector}`);
      return { ok: true, data: { clicked: true, selector }, durationMs: 0 };
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }
  },
};
