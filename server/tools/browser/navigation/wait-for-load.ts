/**
 * server/tools/browser/navigation/wait-for-load.ts
 * Tool: browser_wait_for_load
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                        from '../../registry/tool-metadata.ts';
import { getOrOpenPage }                              from '../session/page-manager.ts';
import { waitForLoad }                                from './page-navigator.ts';
import { browserFail }                                from '../shared/browser-result.ts';

export const browserWaitForLoadTool: ToolDefinition = {
  name:        'browser_wait_for_load',
  category:    'browser',
  description: 'Wait for the page to reach the "load" state',
  inputSchema: {
    timeoutMs: { type: 'number', description: 'Timeout in ms (default 10000)', required: false },
  },
  permissions: ['network'],
  timeoutMs:   TIMEOUT.BROWSER,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const { runId } = ctx;
    const timeoutMs = typeof input.timeoutMs === 'number' ? input.timeoutMs : 10_000;
    try {
      const page = await getOrOpenPage(runId);
      const ok   = await waitForLoad(page, runId, timeoutMs);
      return { ok: true, data: { loaded: ok }, durationMs: timeoutMs };
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }
  },
};
