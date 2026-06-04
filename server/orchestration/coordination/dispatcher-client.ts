/**
 * server/orchestration/coordination/dispatcher-client.ts
 *
 * THE single gateway from the orchestration layer to the tool dispatcher.
 * ALL execution coordination MUST flow through this client — never directly.
 *
 * API STANDARD: executeTool / executeAll / executeSequential
 * (normalized to match agent-layer dispatcher-client naming convention)
 *
 * FORBIDDEN: importing from tool-dispatcher directly.
 * Route through executor's dispatcher-client — it is the sole gateway to the registry.
 */

import {
  dispatch,
  dispatchAll,
  dispatchSequential,
} from '../../agents/executor/coordination/dispatcher-client.ts';
import type {
  ToolExecutionContext,
  ToolExecutionResult,
} from '../../tools/registry/tool-types.ts';
import type { DispatchOptions } from '../../agents/executor/coordination/dispatcher-client.ts';

export type { ToolExecutionResult, ToolExecutionContext };

// ── Single dispatch ───────────────────────────────────────────────────────────

/**
 * Execute a single tool through the central dispatcher.
 * Never throws — always returns a ToolExecutionResult.
 */
export async function executeTool<TOutput = unknown>(
  toolName: string,
  input:    Record<string, unknown>,
  context:  ToolExecutionContext,
  opts:     DispatchOptions = {},
): Promise<ToolExecutionResult<TOutput>> {
  return dispatch<Record<string, unknown>, TOutput>(toolName, input, context, opts);
}

// ── Parallel dispatch ─────────────────────────────────────────────────────────

/**
 * Execute multiple tools in parallel.
 * Individual failures do not abort sibling executions.
 */
export async function executeAll<TOutput = unknown>(
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
 * Execute tools in sequence, stopping on first failure.
 */
export async function executeSequential<TOutput = unknown>(
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
