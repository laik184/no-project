/**
 * server/agents/supervisor/core/supervisor-context.ts
 *
 * Immutable execution context threaded through the entire supervision pipeline.
 * Wraps ToolExecutionContext for agent-layer consumption.
 */

import type { ToolExecutionContext } from '../../../tools/registry/tool-types.ts';

export interface SupervisionContext {
  readonly runId:       string;
  readonly projectId:   string;
  readonly sandboxRoot: string;
  readonly goal:        string;
  readonly signal?:     AbortSignal;
  readonly toolCtx:     ToolExecutionContext;
  readonly meta:        Readonly<Record<string, unknown>>;
}

/**
 * Build an immutable SupervisionContext from primitive inputs.
 * The nested toolCtx is what gets forwarded to the dispatcher.
 */
export function buildSupervisionContext(
  runId:       string,
  projectId:   string,
  sandboxRoot: string,
  goal:        string,
  meta:        Record<string, unknown> = {},
  signal?:     AbortSignal,
): SupervisionContext {
  const toolCtx: ToolExecutionContext = Object.freeze({
    runId, projectId, sandboxRoot, meta, signal,
  });
  return Object.freeze({
    runId, projectId, sandboxRoot, goal, signal,
    toolCtx,
    meta: Object.freeze(meta),
  });
}
