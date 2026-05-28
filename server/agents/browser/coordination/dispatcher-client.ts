/**
 * server/agents/browser/coordination/dispatcher-client.ts
 *
 * SOLE gateway from the browser agent to the central tool dispatcher.
 * ALL browser tool calls — including session lifecycle — MUST flow through here.
 * No imports from server/tools/browser/** are allowed in server/agents/browser/**.
 */

import {
  dispatch,
  dispatchSequential,
  dispatchAll,
}                               from '../../../tools/registry/tool-dispatcher.ts';
import type {
  ToolExecutionContext,
  ToolExecutionResult,
}                               from '../../../tools/registry/tool-types.ts';
import type { DispatchOptions } from '../../../tools/registry/tool-dispatcher.ts';

export type { ToolExecutionContext, ToolExecutionResult };

// ── Single dispatch ───────────────────────────────────────────────────────────

export async function executeTool<TOut = unknown>(
  toolName: string,
  input:    Record<string, unknown>,
  ctx:      ToolExecutionContext,
  opts:     DispatchOptions = {},
): Promise<ToolExecutionResult<TOut>> {
  return dispatch<Record<string, unknown>, TOut>(toolName, input, ctx, opts);
}

// ── Sequential dispatch (stops on first failure) ──────────────────────────────

export async function executeSequential<TOut = unknown>(
  calls: Array<{
    toolName: string;
    input:    Record<string, unknown>;
    ctx:      ToolExecutionContext;
    opts?:    DispatchOptions;
  }>,
): Promise<Array<ToolExecutionResult<TOut>>> {
  return dispatchSequential<TOut>(
    calls.map(c => ({ name: c.toolName, input: c.input, context: c.ctx, opts: c.opts })),
  );
}

// ── Parallel dispatch (all run, collect results) ──────────────────────────────

export async function executeAll<TOut = unknown>(
  calls: Array<{
    toolName: string;
    input:    Record<string, unknown>;
    ctx:      ToolExecutionContext;
    opts?:    DispatchOptions;
  }>,
): Promise<Array<ToolExecutionResult<TOut>>> {
  return dispatchAll<TOut>(
    calls.map(c => ({ name: c.toolName, input: c.input, context: c.ctx, opts: c.opts })),
  );
}

// ── Session lifecycle via tools ───────────────────────────────────────────────

export interface LaunchSessionResult {
  sessionId: string;
  runId:     string;
}

/**
 * Launch a browser session through the tool dispatcher.
 * Never throws — returns ToolExecutionResult.
 */
export async function launchSession(
  ctx:        ToolExecutionContext,
  headless    = true,
  timeoutMs?: number,
): Promise<ToolExecutionResult<LaunchSessionResult>> {
  return executeTool<LaunchSessionResult>('browser_launch', {
    headless,
    timeoutMs: timeoutMs ?? 30_000,
  }, ctx, { timeoutMs: (timeoutMs ?? 30_000) + 5_000 });
}

/**
 * Close a browser session through the tool dispatcher.
 * Never throws — returns ToolExecutionResult.
 */
export async function closeSession(
  ctx: ToolExecutionContext,
): Promise<ToolExecutionResult<{ closed: boolean; runId: string }>> {
  return executeTool<{ closed: boolean; runId: string }>('browser_close', {}, ctx);
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
