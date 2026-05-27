/**
 * server/tools/browser/navigation/run-user-flow.ts
 * Tool: browser_run_flow
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                        from '../../registry/tool-metadata.ts';
import { getSession }                                 from '../session/browser-context.ts';
import { runUserFlow }                                from './user-flow-runner.ts';
import { browserFail }                                from '../shared/browser-result.ts';
import type { UserFlowInput }                         from '../shared/browser-types.ts';

export const browserRunFlowTool: ToolDefinition = {
  name:        'browser_run_flow',
  category:    'browser',
  description: 'Execute a named sequence of browser interactions (navigate, click, fill, assert, screenshot)',
  inputSchema: {
    flowName: { type: 'string', description: 'Name of the flow',         required: true },
    steps:    { type: 'array',  description: 'Array of FlowStep objects', required: true },
  },
  permissions: ['network'],
  timeoutMs:   TIMEOUT.LONG,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const { runId } = ctx;
    const i = input as unknown as UserFlowInput;

    if (!i.flowName || typeof i.flowName !== 'string') {
      return browserFail('[flowName] must be a non-empty string');
    }
    if (!Array.isArray(i.steps) || i.steps.length === 0) {
      return browserFail('[steps] must be a non-empty array');
    }

    try {
      const live   = getSession(runId);
      const result = await runUserFlow(live.page, runId, live.sessionId, i.flowName, i.steps);
      return { ok: true, data: result, durationMs: result.durationMs };
    } catch (err) {
      return browserFail(err instanceof Error ? err.message : String(err));
    }
  },
};
