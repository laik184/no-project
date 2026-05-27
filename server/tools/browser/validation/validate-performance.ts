/**
 * server/tools/browser/validation/validate-performance.ts
 * Tool: browser_validate_performance
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                        from '../../registry/tool-metadata.ts';
import { getOrOpenPage }                              from '../session/page-manager.ts';
import { validatePerformance }                        from './performance-tracker.ts';
import { browserFail }                                from '../shared/browser-result.ts';

export const browserValidatePerformanceTool: ToolDefinition = {
  name:        'browser_validate_performance',
  category:    'browser',
  description: 'Validate page load time against a configurable threshold',
  inputSchema: {
    thresholdMs: { type: 'number', description: 'Max acceptable load time in ms (default 5000)', required: false },
  },
  permissions: ['network'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const { runId } = ctx;
    const thresholdMs = typeof input.thresholdMs === 'number' ? input.thresholdMs : undefined;
    try {
      const page   = await getOrOpenPage(runId);
      const result = await validatePerformance(page, runId, thresholdMs);
      return { ok: true, data: result, durationMs: 0 };
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }
  },
};
