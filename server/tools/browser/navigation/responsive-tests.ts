/**
 * server/tools/browser/navigation/responsive-tests.ts
 * Tool: browser_responsive_tests
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                        from '../../registry/tool-metadata.ts';
import { getSession }                                 from '../session/browser-context.ts';
import { runResponsiveTests, VIEWPORTS }              from '../../../agents/browser/navigation/responsive-tester.ts';
import { assertUrl }                                  from '../validation-core/url-validator.ts';
import { browserFail }                                from '../shared/browser-result.ts';
import type { ResponsiveTestInput }                   from '../shared/browser-types.ts';

export const browserResponsiveTestsTool: ToolDefinition = {
  name:        'browser_responsive_tests',
  category:    'browser',
  description: 'Run mobile/tablet/desktop responsive tests against a URL',
  inputSchema: {
    url:       { type: 'string', description: 'URL to test',            required: true  },
    viewports: { type: 'array',  description: 'Array of ViewportSize', required: false },
  },
  permissions: ['network'],
  timeoutMs:   TIMEOUT.LONG,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const { runId } = ctx;
    const i = input as unknown as ResponsiveTestInput;

    let url: string;
    try {
      url = assertUrl(i.url);
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }

    try {
      const live    = getSession(runId);
      const vps     = Array.isArray(i.viewports) && i.viewports.length ? i.viewports : VIEWPORTS;
      const results = await runResponsiveTests(live.page, runId, live.sessionId, url, vps);
      const passed  = results.filter((r) => r.ok).length;
      return { ok: true, data: { results, passed, total: results.length }, durationMs: 0 };
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }
  },
};
