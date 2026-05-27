/**
 * server/tools/browser/navigation/reload-page.ts
 * Tool: browser_reload
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                        from '../../registry/tool-metadata.ts';
import { getOrOpenPage }                              from '../session/page-manager.ts';
import { reloadPage }                                 from './page-navigator.ts';
import { browserFail }                                from '../shared/browser-result.ts';

export const browserReloadTool: ToolDefinition = {
  name:        'browser_reload',
  category:    'browser',
  description: 'Reload the current page in the active browser session',
  inputSchema: {},
  permissions: ['network'],
  timeoutMs:   TIMEOUT.BROWSER,
  retry:       RETRY_NONE,

  handler: async (_input, ctx: ToolExecutionContext) => {
    const { runId } = ctx;
    try {
      const page = await getOrOpenPage(runId);
      const ok   = await reloadPage(page, runId);
      return { ok: true, data: { reloaded: ok }, durationMs: 0 };
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }
  },
};
