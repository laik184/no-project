/**
 * server/tools/planner/register-planner-tools.ts
 *
 * Registers planner-layer tools with the central tool registry.
 * Call once at application boot via tool-loader.ts, before sealRegistry().
 *
 * Purpose: create_execution_plan is referenced by the planner coordinator
 * dispatch path. Registering it as a no-op acknowledgement tool prevents
 * ToolNotFoundError from breaking the planner lifecycle.
 */

import { registerTool }     from '../registry/tool-registry.ts';
import type { ToolDefinition } from '../registry/tool-types.ts';

// ── create_execution_plan — acknowledgement tool ───────────────────────────────
//
// The planner builds and returns a fully-validated ExecutionPlan via
// buildExecutionPlan(). The coordinator dispatch that calls this tool is a
// broadcast step — the plan is already available. This handler simply
// acknowledges receipt so the dispatch path completes cleanly.

const createExecutionPlanTool: ToolDefinition<Record<string, unknown>, Record<string, unknown>> = {
  name:        'create_execution_plan',
  category:    'coding',
  description: 'Acknowledges receipt of a planner-generated execution plan. No-op — plan is already built.',
  inputSchema: {
    planId:     { type: 'string',  description: 'Plan identifier',    required: false },
    runId:      { type: 'string',  description: 'Run identifier',     required: false },
    projectId:  { type: 'string',  description: 'Project identifier', required: false },
    goal:       { type: 'string',  description: 'Original goal',      required: false },
    sealed:     { type: 'boolean', description: 'Seal flag',          required: false },
    taskCount:  { type: 'number',  description: 'Task count',         required: false },
    phaseCount: { type: 'number',  description: 'Phase count',        required: false },
  },
  permissions: [],
  timeoutMs:   2_000,
  retry: { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler: async (input) => ({
    acknowledged: true,
    planId:       input.planId,
    runId:        input.runId,
    sealed:       input.sealed ?? false,
  }),
};

let _registered = false;

export function registerPlannerTools(opts: { force?: boolean } = {}): void {
  if (_registered && !opts.force) return;
  registerTool(createExecutionPlanTool, opts);
  _registered = true;
  console.log('[register-planner-tools] Registered 1 planner tool (create_execution_plan)');
}
