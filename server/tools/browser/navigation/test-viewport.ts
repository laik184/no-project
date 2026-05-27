/**
 * server/tools/browser/navigation/test-viewport.ts
 * Tool: browser_test_viewport
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                        from '../../registry/tool-metadata.ts';
import { getSession }                                 from '../session/browser-context.ts';
import { testViewport }                               from '../../../agents/browser/navigation/responsive-tester.ts';
import { assertUrl }                                  from '../validation-core/url-validator.ts';
import { browserFail }                                from '../shared/browser-result.ts';
import type { ViewportTestInput }                     from '../shared/browser-types.ts';

export const browserTestViewportTool: ToolDefinition = {
  name:        'browser_test_viewport',
  category:    'browser',
  description: 'Test a URL at a specific viewport size and capture a screenshot',
  inputSchema: {
    url:      { type: 'string', description: 'URL to test',              required: true },
    viewport: { type: 'object', description: 'ViewportSize { width, height, label }', required: true },
  },
  permissions: ['network'],
  timeoutMs:   TIMEOUT.BROWSER,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const { runId } = ctx;
    const i = input as unknown as ViewportTestInput;

    let url: string;
    try {
      url = assertUrl(i.url);
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }

    if (!i.viewport || typeof i.viewport !== 'object') {
      return browserFail('[viewport] must be an object with width, height, label');
    }

    try {
      const live   = getSession(runId);
      const result = await testViewport(live.page, runId, live.sessionId, url, i.viewport);
      return { ok: true, data: result, durationMs: result.durationMs };
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }
  },
};
