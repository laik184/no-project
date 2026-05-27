/**
 * server/tools/browser/validation/collect-performance.ts
 * Tool: browser_collect_performance
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                        from '../../registry/tool-metadata.ts';
import { getOrOpenPage }                              from '../session/page-manager.ts';
import { collectPerformanceTiming }                   from './performance-tracker.ts';
import { browserFail }                                from '../shared/browser-result.ts';

export const browserCollectPerformanceTool: ToolDefinition = {
  name:        'browser_collect_performance',
  category:    'browser',
  description: 'Collect Navigation Timing metrics (load time, DOM ready) from the current page',
  inputSchema: {},
  permissions: ['network'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (_input, ctx: ToolExecutionContext) => {
    const { runId } = ctx;
    try {
      const page   = await getOrOpenPage(runId);
      const result = await collectPerformanceTiming(page, runId);
      return { ok: true, data: result, durationMs: 0 };
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }
  },
};
