/**
 * server/agents/terminal/coordination/dispatcher-client.ts
 *
 * THE ONLY gateway from the terminal agent to the tool execution layer.
 * Every tool invocation MUST go through this module.
 * No child_process, no spawn, no exec, no shell calls anywhere in agents/terminal.
 *
 * Telemetry (metrics, logging, failure recording) is owned by the STEP-RUNNER,
 * not this gateway. This module is a pure pass-through to tool-dispatcher.
 */

import {
  dispatch,
  type DispatchOptions,
} from '../../executor/coordination/dispatcher-client.ts';
import type { ToolExecutionContext, ToolExecutionResult } from '../../../shared/types/execution-contracts.ts';

export type { ToolExecutionContext, ToolExecutionResult };

export interface TerminalDispatchOptions {
  timeoutMs?: number;
  label?:     string;
}

// ── Type-safe result helpers ──────────────────────────────────────────────────

type FailResult = { ok: false; error: string; code: string; durationMs: number };

export function resultError<T>(r: ToolExecutionResult<T>): string {
  return (r as unknown as FailResult).error ?? 'Unknown error';
}

export function resultOk<T>(r: ToolExecutionResult<T>): T {
  if (!r.ok) throw new Error(`Expected ok result but got error: ${resultError(r)}`);
  return (r as { ok: true; data: T }).data;
}

// ── Core dispatch ─────────────────────────────────────────────────────────────

/**
 * Dispatch a single terminal tool. Returns a typed ToolExecutionResult.
 * Never throws — all errors are captured in the result envelope.
 * Telemetry (logging/metrics) belongs in the step-runner — NOT here.
 */
export async function executeTool<TOutput = unknown>(
  toolName: string,
  input:    Record<string, unknown>,
  context:  ToolExecutionContext,
  opts:     TerminalDispatchOptions = {},
): Promise<ToolExecutionResult<TOutput>> {
  const dispatchOpts: DispatchOptions = {};
  if (opts.timeoutMs) dispatchOpts.timeoutMs = opts.timeoutMs;
  return dispatch<Record<string, unknown>, TOutput>(toolName, input, context, dispatchOpts);
}

/**
 * Dispatch multiple tools in parallel. Individual failures do not abort siblings.
 */
export async function executeAll<TOutput = unknown>(
  calls: Array<{
    toolName: string;
    input:    Record<string, unknown>;
    context:  ToolExecutionContext;
    opts?:    TerminalDispatchOptions;
  }>,
): Promise<Array<ToolExecutionResult<TOutput>>> {
  return Promise.all(calls.map((c) => executeTool<TOutput>(c.toolName, c.input, c.context, c.opts)));
}

/**
 * Dispatch tools sequentially, stopping on first failure.
 */
export async function executeSequential<TOutput = unknown>(
  calls: Array<{
    toolName: string;
    input:    Record<string, unknown>;
    context:  ToolExecutionContext;
    opts?:    TerminalDispatchOptions;
  }>,
): Promise<Array<ToolExecutionResult<TOutput>>> {
  const results: Array<ToolExecutionResult<TOutput>> = [];
  for (const call of calls) {
    const result = await executeTool<TOutput>(call.toolName, call.input, call.context, call.opts);
    results.push(result);
    if (!result.ok) break;
  }
  return results;
}

/** Build a ToolExecutionContext for a terminal agent run. */
export function buildContext(
  runId:       string,
  projectId:   string,
  sandboxRoot: string,
  meta:        Record<string, unknown> = {},
  signal?:     AbortSignal,
): ToolExecutionContext {
  return Object.freeze({ runId, projectId, sandboxRoot, meta, signal });
}
