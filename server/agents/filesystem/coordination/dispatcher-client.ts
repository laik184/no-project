/**
 * server/agents/filesystem/coordination/dispatcher-client.ts
 *
 * THE single gateway from the filesystem agent to the central tool dispatcher.
 * All tool execution MUST flow through this client — never directly.
 *
 * This file may import from the tool registry dispatcher only.
 * It must NOT import from any tool implementation.
 */

import { dispatch, dispatchSequential, dispatchAll } from '../../../tools/registry/tool-dispatcher.ts';
import type { ToolExecutionContext, ToolExecutionResult } from '../../../tools/registry/tool-types.ts';
import type { DispatchOptions } from '../../../tools/registry/tool-dispatcher.ts';

// ── Re-export types needed by callers ─────────────────────────────────────────

export type { ToolExecutionResult, ToolExecutionContext };

// ── Single tool execution ─────────────────────────────────────────────────────

/**
 * Execute a single tool by name through the central dispatcher.
 * Never throws — always returns ToolExecutionResult.
 */
export async function execute<TOutput = unknown>(
  toolName:  string,
  input:     Record<string, unknown>,
  context:   ToolExecutionContext,
  opts:      DispatchOptions = {},
): Promise<ToolExecutionResult<TOutput>> {
  return dispatch<Record<string, unknown>, TOutput>(toolName, input, context, opts);
}

// ── Sequential execution (stop on first failure) ──────────────────────────────

/**
 * Execute a series of tools in sequence.
 * Halts the sequence on the first failure.
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
    calls.map((c) => ({
      name:    c.toolName,
      input:   c.input,
      context: c.context,
      opts:    c.opts,
    })),
  );
}

// ── Parallel execution (independent sibling calls) ────────────────────────────

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
    calls.map((c) => ({
      name:    c.toolName,
      input:   c.input,
      context: c.context,
      opts:    c.opts,
    })),
  );
}
