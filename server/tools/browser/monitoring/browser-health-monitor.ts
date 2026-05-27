/**
 * server/tools/browser/monitoring/browser-health-monitor.ts
 * Tool: browser_health
 *
 * Reports whether the active browser session is alive and responsive.
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                        from '../../registry/tool-metadata.ts';
import { hasSession, getSession }                     from '../session/browser-context.ts';
import { browserFail }                                from '../shared/browser-result.ts';

export const browserHealthTool: ToolDefinition = {
  name:        'browser_health',
  category:    'browser',
  description: 'Check whether the active browser session is alive and the page is responsive',
  inputSchema: {},
  permissions: ['network'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (_input, ctx: ToolExecutionContext) => {
    const { runId } = ctx;

    if (!hasSession(runId)) {
      return {
        ok: true,
        data: { alive: false, sessionId: null, reason: 'No active session' },
        durationMs: 0,
      };
    }

    try {
      const live = getSession(runId);
      // Probe page responsiveness with a minimal evaluate
      await live.page.evaluate(() => true);
      return {
        ok: true,
        data: { alive: true, sessionId: live.sessionId, url: live.page.url() },
        durationMs: 0,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return browserFail(`Session health check failed: ${msg}`);
    }
  },
};
