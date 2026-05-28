/**
 * server/agents/terminal/core/terminal-context.ts
 *
 * Immutable execution context passed through the terminal agent pipeline.
 * Wraps ToolExecutionContext for agent-layer consumption.
 */

import type { ToolExecutionContext } from '../../../tools/registry/tool-types.ts';

export interface TerminalExecutionContext {
  readonly runId:       string;
  readonly projectId:   string;
  readonly sandboxRoot: string;
  readonly signal?:     AbortSignal;
  readonly toolCtx:     ToolExecutionContext;
  readonly meta:        Readonly<Record<string, unknown>>;
}

/**
 * Build an immutable TerminalExecutionContext from primitive inputs.
 * The nested toolCtx is what gets passed to the dispatcher.
 */
export function buildTerminalContext(
  runId:       string,
  projectId:   string,
  sandboxRoot: string,
  meta:        Record<string, unknown> = {},
  signal?:     AbortSignal,
): TerminalExecutionContext {
  const toolCtx: ToolExecutionContext = Object.freeze({ runId, projectId, sandboxRoot, meta, signal });
  return Object.freeze({ runId, projectId, sandboxRoot, signal, toolCtx, meta: Object.freeze(meta) });
}
