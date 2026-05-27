/**
 * server/tools/browser/monitoring/action-logger.ts
 * Tool: browser_get_action_log
 *
 * Exposes the per-run action trace recorded by the browser agent primitives.
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                        from '../../registry/tool-metadata.ts';
import { actionTrace }                                from '../../../agents/browser/telemetry/action-trace.ts';

export const browserGetActionLogTool: ToolDefinition = {
  name:        'browser_get_action_log',
  category:    'browser',
  description: 'Retrieve the ordered action trace for the current run (navigate, click, fill, screenshot, etc.)',
  inputSchema: {},
  permissions: ['network'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (_input, ctx: ToolExecutionContext) => {
    const entries = actionTrace.getAll(ctx.runId);
    return {
      ok: true,
      data: { entries, count: entries.length },
      durationMs: 0,
    };
  },
};
