/**
 * server/tools/browser/interaction/is-element-present.ts
 * Tool: browser_is_element_present
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                        from '../../registry/tool-metadata.ts';
import { getOrOpenPage }                              from '../session/page-manager.ts';
import { isElementPresent }                           from './element-finder.ts';
import { assertSelector }                             from '../validation-core/selector-validator.ts';
import { browserFail }                                from '../shared/browser-result.ts';

export const browserIsElementPresentTool: ToolDefinition = {
  name:        'browser_is_element_present',
  category:    'browser',
  description: 'Check whether at least one element matching the selector exists in the DOM',
  inputSchema: {
    selector: { type: 'string', description: 'CSS or Playwright selector', required: true },
  },
  permissions: ['network'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const { runId } = ctx;
    let selector: string;
    try {
      selector = assertSelector(input.selector);
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }
    try {
      const page    = await getOrOpenPage(runId);
      const present = await isElementPresent(page, selector);
      return { ok: true, data: { present, selector }, durationMs: 0 };
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }
  },
};
