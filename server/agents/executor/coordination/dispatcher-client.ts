/**
 * server/agents/executor/coordination/dispatcher-client.ts
 *
 * THE single gateway from the executor agent to the central tool dispatcher.
 * ALL tool execution MUST flow through this client — never directly.
 *
 * Imports ONLY from the tool registry dispatcher — never from tool implementations.
 */

import { dispatch, dispatchAll, dispatchSequential } from '../../../tools/registry/tool-dispatcher.ts';
import type { ToolExecutionContext, ToolExecutionResult } from '../../../shared/types/execution-contracts.ts';
import type { DispatchOptions } from '../../../tools/registry/tool-dispatcher.ts';

export type { ToolExecutionResult, ToolExecutionContext };

/**
 * Execute a single tool through the central dispatcher.
 * Never throws — always returns ToolExecutionResult.
 */
export async function executeTool<TOutput = unknown>(
  toolName: string,
  input:    Record<string, unknown>,
  context:  ToolExecutionContext,
  opts:     DispatchOptions = {},
): Promise<ToolExecutionResult<TOutput>> {
  return dispatch<Record<string, unknown>, TOutput>(toolName, input, context, opts);
}

/**
 * Execute multiple tools in parallel.
 * Individual failures do not abort sibling calls.
 */
export async function executeAll<TOutput = unknown>(
  calls: Array<{
    toolName: string;
    input:    Record<string, unknown>;
    context:  ToolExecutionContext;
    opts?:    DispatchOptions;
  }>,
): Promise<Array<ToolExecutionResult<TOutput>>> {
  return dispatchAll<TOutput>(
    calls.map((c) => ({ name: c.toolName, input: c.input, context: c.context, opts: c.opts })),
  );
}

/**
 * Execute tools in sequence, stopping on first failure.
 */
export async function executeSequential<TOutput = unknown>(
  calls: Array<{
    toolName: string;
    input:    Record<string, unknown>;
    context:  ToolExecutionContext;
    opts?:    DispatchOptions;
  }>,
): Promise<Array<ToolExecutionResult<TOutput>>> {
  return dispatchSequential<TOutput>(
    calls.map((c) => ({ name: c.toolName, input: c.input, context: c.context, opts: c.opts })),
  );
}
