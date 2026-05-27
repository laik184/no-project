/**
 * server/tools/browser/capture/take-element-screenshot.ts
 * Tool: browser_element_screenshot
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                        from '../../registry/tool-metadata.ts';
import { getSession }                                 from '../session/browser-context.ts';
import { takeElementScreenshot }                      from './screenshot-taker.ts';
import { assertSelector }                             from '../validation-core/selector-validator.ts';
import { validateScreenshotLabel }                    from '../validation-core/screenshot-validator.ts';
import { browserFail }                                from '../shared/browser-result.ts';

export const browserElementScreenshotTool: ToolDefinition = {
  name:        'browser_element_screenshot',
  category:    'browser',
  description: 'Capture a screenshot of a specific DOM element',
  inputSchema: {
    selector: { type: 'string', description: 'CSS or Playwright selector', required: true },
    label:    { type: 'string', description: 'Screenshot label',           required: true },
  },
  permissions: ['network', 'write'],
  timeoutMs:   TIMEOUT.BROWSER,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const { runId } = ctx;
    let selector: string;
    let label:    string;
    try {
      selector = assertSelector(input.selector);
      label    = validateScreenshotLabel(input.label);
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }
    try {
      const live = getSession(runId);
      const meta = await takeElementScreenshot(live.page, runId, live.sessionId, selector, label);
      if (!meta) return browserFail(`Element screenshot failed: ${selector}`);
      return { ok: true, data: meta, durationMs: 0 };
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }
  },
};
