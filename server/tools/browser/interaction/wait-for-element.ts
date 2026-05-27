/**
 * server/tools/browser/interaction/wait-for-element.ts
 * Tool: browser_wait_for_element
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                        from '../../registry/tool-metadata.ts';
import { getOrOpenPage }                              from '../session/page-manager.ts';
import { waitForElement }                             from '../../../agents/browser/interaction/element-finder.ts';
import { assertSelector }                             from '../validation-core/selector-validator.ts';
import { clampInteractionTimeout }                    from '../validation-core/interaction-validator.ts';
import { browserFail }                                from '../shared/browser-result.ts';

export const browserWaitForElementTool: ToolDefinition = {
  name:        'browser_wait_for_element',
  category:    'browser',
  description: 'Wait until an element is attached to the DOM (not necessarily visible)',
  inputSchema: {
    selector:  { type: 'string', description: 'CSS or Playwright selector', required: true  },
    timeoutMs: { type: 'number', description: 'Max wait in ms',             required: false },
  },
  permissions: ['network'],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_NONE,

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
      const page  = await getOrOpenPage(runId);
      const found = await waitForElement(page, runId, selector, timeoutMs);
      if (!found) return browserFail(`Element not found within ${timeoutMs}ms: ${selector}`);
      return { ok: true, data: { found: true, selector }, durationMs: timeoutMs };
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }
  },
};
