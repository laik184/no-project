/**
 * server/tools/browser/monitoring/browser-metrics.ts
 * Tool: browser_get_metrics
 *
 * Exposes per-run browser telemetry counters accumulated by the agent primitives.
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                        from '../../registry/tool-metadata.ts';
import { browserMetrics }                             from '../../../agents/browser/telemetry/browser-metrics.ts';

export const browserGetMetricsTool: ToolDefinition = {
  name:        'browser_get_metrics',
  category:    'browser',
  description: 'Get telemetry counters for the current run: screenshots, interactions, console errors, crashes, flows',
  inputSchema: {},
  permissions: ['network'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (_input, ctx: ToolExecutionContext) => {
    const metrics = browserMetrics.get(ctx.runId);
    return {
      ok: true,
      data: metrics,
      durationMs: 0,
    };
  },
};
