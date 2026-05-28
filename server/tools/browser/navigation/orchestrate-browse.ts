/**
 * server/tools/browser/navigation/orchestrate-browse.ts
 * Tool: orchestrate_browse
 *
 * THE missing link between agent-coordinator.ts and browser-agent.ts.
 *
 * agent-coordinator.ts calls:
 *   routeCommand('orchestrate_browse', ...) → dispatcher → THIS tool → runBrowserAgent()
 *
 * Without this file the 'orchestrate_browse' tool name was defined in
 * AGENT_TOOL_MAP but never registered, so every browser dispatch returned
 * code: 'NOT_FOUND' and the browser agent was never reached.
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                        from '../../registry/tool-metadata.ts';
import { runBrowserAgent }                            from '../../../agents/browser/browser-agent.ts';
import type { RunBrowserAgentInput }                  from '../shared/browser-types.ts';

export const orchestrateBrowseTool: ToolDefinition = {
  name:        'orchestrate_browse',
  category:    'browser',
  description: 'Orchestration entry-point: runs the full Browser Agent lifecycle for a single run. '
             + 'Called exclusively by agent-coordinator via the dispatcher pipeline.',
  inputSchema: {
    url:              { type: 'string',  description: 'Target URL to browse/verify',              required: true  },
    runId:            { type: 'string',  description: 'Run ID (injected by orchestration layer)',  required: false },
    projectId:        { type: 'string',  description: 'Project ID',                               required: false },
    allowedHosts:     { type: 'array',   description: 'Hosts the agent is permitted to navigate', required: false },
    flows:            { type: 'array',   description: 'Named flow definitions to execute',        required: false },
    testResponsive:   { type: 'boolean', description: 'Run responsive viewport tests',            required: false },
    captureScreenshot:{ type: 'boolean', description: 'Capture a screenshot after load',          required: false },
    validateUI:       { type: 'boolean', description: 'Run UI validation checks',                 required: false },
    timeoutMs:        { type: 'number',  description: 'Override default agent timeout',           required: false },
    probe:            { type: 'boolean', description: 'Lightweight readiness ping — skip real work', required: false },
  },
  permissions: ['network'],
  timeoutMs:   TIMEOUT.LONG,
  retry:       RETRY_ONCE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const i = input as unknown as RunBrowserAgentInput & {
      probe?: boolean;
      phaseId?: string;
      phaseName?: string;
    };

    if (i.probe === true) {
      return { ok: true, data: { probeOk: true, agent: 'browser' }, durationMs: 0 };
    }

    if (!i.url || typeof i.url !== 'string') {
      return {
        ok:        false,
        error:     '[orchestrate_browse] Missing required field: url',
        code:      'EXECUTION_ERROR',
        durationMs: 0,
      };
    }

    const runId     = (i as any).runId     ?? ctx.runId     ?? 'unknown';
    const projectId = (i as any).projectId ?? ctx.projectId ?? 'unknown';

    const start  = Date.now();
    const result = await runBrowserAgent({
      url:              i.url,
      runId,
      projectId,
      allowedHosts:     i.allowedHosts,
      flows:            i.flows,
      testResponsive:   i.testResponsive,
      captureScreenshot: i.captureScreenshot,
      validateUI:       i.validateUI,
      timeoutMs:        i.timeoutMs,
    });

    return {
      ok:        result.ok,
      data:      result,
      durationMs: Date.now() - start,
      ...(result.ok ? {} : { error: result.error ?? 'Browser agent failed', code: 'EXECUTION_ERROR' as const }),
    };
  },
};
