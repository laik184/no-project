/**
 * server/tools/browser/validation/blank-screen-detector.ts
 * Tool: browser_detect_blank_screen
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                        from '../../registry/tool-metadata.ts';
import { getOrOpenPage }                              from '../session/page-manager.ts';
import { browserFail }                                from '../shared/browser-result.ts';

const BLANK_BODY_THRESHOLD = 200;

export const browserDetectBlankScreenTool: ToolDefinition = {
  name:        'browser_detect_blank_screen',
  category:    'browser',
  description: 'Detect whether the current page is blank (empty body / white screen)',
  inputSchema: {},
  permissions: ['network'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (_input, ctx: ToolExecutionContext) => {
    const { runId } = ctx;
    try {
      const page    = await getOrOpenPage(runId);
      const bodyHtml: string = await page.evaluate(() => document.body?.innerHTML ?? '').catch(() => '');
      const bodyText: string = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');
      const title:   string = await page.title().catch(() => '');

      const isBlank = bodyHtml.trim().length < BLANK_BODY_THRESHOLD;
      const isEmpty = bodyText.trim().length < 10;
      const noTitle = !title || title.trim() === '' || title === 'about:blank';

      return {
        ok: true,
        data: {
          isBlank,
          isEmpty,
          noTitle,
          verdict: isBlank || (isEmpty && noTitle),
          url: page.url(),
        },
        durationMs: 0,
      };
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }
  },
};
