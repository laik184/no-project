/**
 * server/tools/browser/capture/take-screenshot.ts
 * Tool: browser_screenshot
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                        from '../../registry/tool-metadata.ts';
import { getSession }                                 from '../session/browser-context.ts';
import { takeScreenshot }                             from '../../../agents/browser/capture/screenshot-taker.ts';
import { validateScreenshotLabel, validateFullPage }  from '../validation-core/screenshot-validator.ts';
import { browserFail }                                from '../shared/browser-result.ts';

export const browserScreenshotTool: ToolDefinition = {
  name:        'browser_screenshot',
  category:    'browser',
  description: 'Capture a full-page or viewport screenshot from the active browser session',
  inputSchema: {
    label:    { type: 'string',  description: 'Screenshot label (alphanumeric + _ -)', required: true  },
    fullPage: { type: 'boolean', description: 'Capture full page (default: true)',      required: false },
    timeoutMs:{ type: 'number',  description: 'Capture timeout in ms',                  required: false },
  },
  permissions: ['network', 'write'],
  timeoutMs:   TIMEOUT.BROWSER,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const { runId } = ctx;
    let label:    string;
    let fullPage: boolean;
    try {
      label    = validateScreenshotLabel(input.label);
      fullPage = validateFullPage(input.fullPage);
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }
    const timeoutMs = typeof input.timeoutMs === 'number' ? input.timeoutMs : 10_000;
    try {
      const live = getSession(runId);
      const meta = await takeScreenshot(live.page, runId, live.sessionId, label, { fullPage, timeoutMs });
      if (!meta) return browserFail(`Screenshot capture failed for label: ${label}`);
      return { ok: true, data: meta, durationMs: 0 };
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }
  },
};
