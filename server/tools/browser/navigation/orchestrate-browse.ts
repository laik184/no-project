/**
 * server/tools/browser/navigation/orchestrate-browse.ts
 *
 * @deprecated ARCHITECTURE VIOLATION — DO NOT USE.
 *
 * This file is a bridge tool that routes Orchestrator → Tool → Agent.
 * That pattern inverts the correct layer discipline:
 *
 *   ❌  OLD (violation):  agent-coordinator → dispatcher → THIS tool → runBrowserAgent()
 *   ✅  NEW (correct):    agent-coordinator → runBrowserAgent() directly
 *
 * agent-coordinator.ts has been refactored to call runBrowserAgent() directly.
 * This file is retained only because the registry still references it at boot.
 * It is now unreachable from the orchestration layer.
 *
 * REMOVAL CHECKLIST (do not delete until all items are verified):
 *   [ ] Remove `orchestrateBrowseTool` from register-browser-tools.ts
 *   [ ] Verify no caller routes 'orchestrate_browse' through the dispatcher
 *   [ ] Delete this file
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                        from '../../registry/tool-metadata.ts';
import { runBrowserAgent }                            from '../../../agents/browser/browser-agent.ts';
import type { RunBrowserAgentInput }                  from '../shared/browser-types.ts';

/** @deprecated See file-level deprecation notice above. */
export const orchestrateBrowseTool: ToolDefinition = {
  name:        'orchestrate_browse',
  category:    'browser',
  description: '[DEPRECATED] Bridge tool — superseded by direct agent invocation in agent-coordinator.ts.',
  inputSchema: {
    url:               { type: 'string',  description: 'Target URL',                required: true  },
    runId:             { type: 'string',  description: 'Run ID',                    required: false },
    projectId:         { type: 'string',  description: 'Project ID',               required: false },
    allowedHosts:      { type: 'array',   description: 'Permitted navigation hosts', required: false },
    flows:             { type: 'array',   description: 'Named flow definitions',    required: false },
    testResponsive:    { type: 'boolean', description: 'Responsive viewport tests', required: false },
    captureScreenshot: { type: 'boolean', description: 'Capture screenshot',        required: false },
    validateUI:        { type: 'boolean', description: 'UI validation checks',      required: false },
    timeoutMs:         { type: 'number',  description: 'Agent timeout override',    required: false },
    probe:             { type: 'boolean', description: 'Readiness ping',            required: false },
  },
  permissions: ['network'],
  timeoutMs:   TIMEOUT.LONG,
  retry:       RETRY_ONCE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const i = input as unknown as RunBrowserAgentInput & { probe?: boolean };

    if (i.probe === true) {
      return { ok: true, data: { probeOk: true, agent: 'browser', deprecated: true }, durationMs: 0 };
    }

    if (!i.url || typeof i.url !== 'string') {
      return { ok: false, error: '[orchestrate_browse] Missing required field: url', code: 'EXECUTION_ERROR', durationMs: 0 };
    }

    const runId     = (i as any).runId     ?? ctx.runId     ?? 'unknown';
    const projectId = (i as any).projectId ?? ctx.projectId ?? 'unknown';
    const start     = Date.now();

    const result = await runBrowserAgent({
      url:               i.url,
      runId,
      projectId,
      allowedHosts:      i.allowedHosts,
      flows:             i.flows,
      testResponsive:    i.testResponsive,
      captureScreenshot: i.captureScreenshot,
      validateUI:        i.validateUI,
      timeoutMs:         i.timeoutMs,
    });

    return {
      ok:        result.ok,
      data:      result,
      durationMs: Date.now() - start,
      ...(result.ok ? {} : { error: result.error ?? 'Browser agent failed', code: 'EXECUTION_ERROR' as const }),
    };
  },
};
