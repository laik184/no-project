/**
 * server/tools/browser/interaction/wait-for-visible.ts
 * Tool: browser_wait_for_visible
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                        from '../../registry/tool-metadata.ts';
import { getOrOpenPage }                              from '../session/page-manager.ts';
import { waitForVisible }                             from '../../../agents/browser/interaction/element-finder.ts';
import { assertSelector }                             from '../validation-core/selector-validator.ts';
import { clampInteractionTimeout }                    from '../validation-core/interaction-validator.ts';
import { browserFail }                                from '../shared/browser-result.ts';

export const browserWaitForVisibleTool: ToolDefinition = {
  name:        'browser_wait_for_visible',
  category:    'browser',
  description: 'Wait until an element is visible in the viewport',
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
      const page    = await getOrOpenPage(runId);
      const visible = await waitForVisible(page, runId, selector, timeoutMs);
      if (!visible) return browserFail(`Element not visible within ${timeoutMs}ms: ${selector}`);
      return { ok: true, data: { visible: true, selector }, durationMs: timeoutMs };
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }
  },
};
