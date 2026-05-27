/**
 * server/tools/browser/navigation/navigate-to-url.ts
 * Tool: browser_navigate
 *
 * Navigates the active browser session to a URL.
 * Sandboxed: only localhost, Replit preview, and explicit allowedHosts are permitted.
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                        from '../../registry/tool-metadata.ts';
import { getOrOpenPage }                              from '../session/page-manager.ts';
import { navigateToUrl }                              from './page-navigator.ts';
import { assertUrl }                                  from '../validation-core/url-validator.ts';
import { browserFail }                                from '../shared/browser-result.ts';
import type { NavigateInput }                         from '../shared/browser-types.ts';

export const browserNavigateTool: ToolDefinition = {
  name:        'browser_navigate',
  category:    'browser',
  description: 'Navigate the active browser session to a URL (sandbox-restricted)',
  inputSchema: {
    url:          { type: 'string',  description: 'Target URL',                         required: true  },
    allowedHosts: { type: 'array',   description: 'Additional allowed hostnames',        required: false },
    timeoutMs:    { type: 'number',  description: 'Navigation timeout in ms (max 30000)', required: false },
  },
  permissions: ['network'],
  timeoutMs:   TIMEOUT.BROWSER,
  retry:       RETRY_NONE,

  handler: async (input: Record<string, unknown>, ctx: ToolExecutionContext) => {
    const { runId } = ctx;
    const i = input as unknown as NavigateInput;

    let url: string;
    try {
      url = assertUrl(i.url, i.allowedHosts ?? []);
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }

    try {
      const page   = await getOrOpenPage(runId);
      const result = await navigateToUrl(page, runId, url, i.allowedHosts ?? [], i.timeoutMs);
      return { ok: true, data: result, durationMs: result.durationMs };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return browserFail(msg);
    }
  },
};
