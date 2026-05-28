/**
 * server/orchestration/coordination/dispatcher-client.ts
 *
 * THE single gateway from the orchestration layer to the central tool dispatcher.
 * ALL execution coordination MUST flow through this client — never directly.
 *
 * Orchestration layer imports only from tool-dispatcher — never from tool implementations.
 */

import {
  dispatch,
  dispatchAll,
  dispatchSequential,
} from '../../tools/registry/tool-dispatcher.ts';
import type {
  ToolExecutionContext,
  ToolExecutionResult,
} from '../../tools/registry/tool-types.ts';
import type { DispatchOptions } from '../../tools/registry/tool-dispatcher.ts';

export type { ToolExecutionResult, ToolExecutionContext };

// ── Single dispatch ───────────────────────────────────────────────────────────

/**
 * Route a single orchestration command through the central dispatcher.
 * Never throws — always returns a ToolExecutionResult.
 */
export async function routeCommand<TOutput = unknown>(
  toolName: string,
  input:    Record<string, unknown>,
  context:  ToolExecutionContext,
  opts:     DispatchOptions = {},
): Promise<ToolExecutionResult<TOutput>> {
  return dispatch<Record<string, unknown>, TOutput>(toolName, input, context, opts);
}

// ── Parallel dispatch ─────────────────────────────────────────────────────────

/**
 * Route multiple orchestration commands in parallel.
 * Individual failures do not abort sibling commands.
 */
export async function routeParallel<TOutput = unknown>(
  commands: Array<{
    toolName: string;
    input:    Record<string, unknown>;
    context:  ToolExecutionContext;
    opts?:    DispatchOptions;
  }>,
): Promise<Array<ToolExecutionResult<TOutput>>> {
  return dispatchAll<TOutput>(
    commands.map(c => ({
      name:    c.toolName,
      input:   c.input,
      context: c.context,
      opts:    c.opts,
    })),
  );
}

// ── Sequential dispatch ───────────────────────────────────────────────────────

/**
 * Route orchestration commands in sequence, stopping on first failure.
 */
export async function routeSequential<TOutput = unknown>(
  commands: Array<{
    toolName: string;
    input:    Record<string, unknown>;
    context:  ToolExecutionContext;
    opts?:    DispatchOptions;
  }>,
): Promise<Array<ToolExecutionResult<TOutput>>> {
  return dispatchSequential<TOutput>(
    commands.map(c => ({
      name:    c.toolName,
      input:   c.input,
      context: c.context,
      opts:    c.opts,
    })),
  );
}
