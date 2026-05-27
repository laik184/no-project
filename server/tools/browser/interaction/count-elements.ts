/**
 * server/tools/browser/interaction/count-elements.ts
 * Tool: browser_count_elements
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                        from '../../registry/tool-metadata.ts';
import { getOrOpenPage }                              from '../session/page-manager.ts';
import { countElements }                              from './element-finder.ts';
import { assertSelector }                             from '../validation-core/selector-validator.ts';
import { browserFail }                                from '../shared/browser-result.ts';

export const browserCountElementsTool: ToolDefinition = {
  name:        'browser_count_elements',
  category:    'browser',
  description: 'Count how many elements match a given selector',
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
      const page  = await getOrOpenPage(runId);
      const count = await countElements(page, selector);
      return { ok: true, data: { count, selector }, durationMs: 0 };
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }
  },
};
