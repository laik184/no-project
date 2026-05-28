/**
 * server/agents/browser/coordination/dispatcher-client.ts
 *
 * SOLE gateway from the browser agent to the central tool dispatcher.
 * All browser tool calls MUST flow through here — never call dispatch() directly
 * from any other file in server/agents/browser/.
 */

import {
  dispatch,
  dispatchSequential,
  dispatchAll,
}                               from '../../tools/registry/tool-dispatcher.ts';
import type {
  ToolExecutionContext,
  ToolExecutionResult,
}                               from '../../tools/registry/tool-types.ts';

export type { ToolExecutionContext, ToolExecutionResult };

// ── Single dispatch ───────────────────────────────────────────────────────────

export async function dispatchBrowserTool<TOut = unknown>(
  toolName: string,
  input:    Record<string, unknown>,
  ctx:      ToolExecutionContext,
): Promise<ToolExecutionResult<TOut>> {
  return dispatch<Record<string, unknown>, TOut>(toolName, input, ctx);
}

// ── Sequential dispatch (stops on first failure) ──────────────────────────────

export async function dispatchBrowserSequence<TOut = unknown>(
  calls: Array<{
    toolName: string;
    input:    Record<string, unknown>;
    ctx:      ToolExecutionContext;
  }>,
): Promise<Array<ToolExecutionResult<TOut>>> {
  return dispatchSequential<TOut>(
    calls.map(c => ({ name: c.toolName, input: c.input, context: c.ctx })),
  );
}

// ── Parallel dispatch (all run, collect results) ──────────────────────────────

export async function dispatchBrowserParallel<TOut = unknown>(
  calls: Array<{
    toolName: string;
    input:    Record<string, unknown>;
    ctx:      ToolExecutionContext;
  }>,
): Promise<Array<ToolExecutionResult<TOut>>> {
  return dispatchAll<TOut>(
    calls.map(c => ({ name: c.toolName, input: c.input, context: c.ctx })),
  );
}

// ── Build context helper ──────────────────────────────────────────────────────

export function buildToolContext(
  runId:     string,
  projectId: string,
  meta:      Record<string, unknown> = {},
): ToolExecutionContext {
  return {
    runId,
    projectId,
    sandboxRoot: process.env.AGENT_PROJECT_ROOT ?? '.sandbox',
    meta,
  };
}
