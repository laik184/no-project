/**
 * server/agents/planner/core/planner-context.ts
 *
 * Immutable execution context threaded through the entire planning pipeline.
 * Wraps ToolExecutionContext for agent-layer consumption.
 */

import type { ToolExecutionContext } from '../../../shared/types/execution-contracts.ts';

export interface PlanningContext {
  readonly runId:       string;
  readonly projectId:   string;
  readonly sandboxRoot: string;
  readonly goal:        string;
  readonly signal?:     AbortSignal;
  readonly toolCtx:     ToolExecutionContext;
  readonly meta:        Readonly<Record<string, unknown>>;
}

/**
 * Build an immutable PlanningContext from primitive inputs.
 * The nested toolCtx is forwarded to the dispatcher layer.
 */
export function buildPlanningContext(
  runId:       string,
  projectId:   string,
  sandboxRoot: string,
  goal:        string,
  meta:        Record<string, unknown> = {},
  signal?:     AbortSignal,
): PlanningContext {
  const toolCtx: ToolExecutionContext = Object.freeze({
    runId, projectId, sandboxRoot, meta, signal,
  });
  return Object.freeze({
    runId, projectId, sandboxRoot, goal, signal,
    toolCtx,
    meta: Object.freeze({ ...meta }),
  });
}
