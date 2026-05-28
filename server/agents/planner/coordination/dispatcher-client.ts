/**
 * server/agents/planner/coordination/dispatcher-client.ts
 *
 * THE ONLY gateway from the planner agent to the tool execution layer.
 * Every agent-route invocation MUST go through this module.
 * No child_process, no spawn, no exec, no shell calls anywhere in agents/planner.
 */

import {
  dispatch,
  type DispatchOptions,
} from '../../../tools/registry/tool-dispatcher.ts';
import type {
  ToolExecutionContext,
  ToolExecutionResult,
} from '../../../tools/registry/tool-types.ts';
import { plannerLogger }  from '../telemetry/planner-logger.ts';
import { plannerMetrics } from '../telemetry/planner-metrics.ts';
import { planningMonitor } from '../monitoring/planning-monitor.ts';

export type { ToolExecutionContext, ToolExecutionResult };

export interface PlannerDispatchOptions {
  timeoutMs?: number;
  attempt?:   number;
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
 * Dispatch a single planning tool. Returns a typed ToolExecutionResult.
 * Never throws — all errors are captured in the result envelope.
 */
export async function dispatchTool<TOutput = unknown>(
  toolName: string,
  input:    Record<string, unknown>,
  context:  ToolExecutionContext,
  opts:     PlannerDispatchOptions = {},
): Promise<ToolExecutionResult<TOutput>> {
  const start   = Date.now();
  const attempt = opts.attempt ?? 1;
  const label   = opts.label ?? toolName;

  plannerLogger.task(context.runId, label, 'dispatch', { toolName, attempt });

  const dispatchOpts: DispatchOptions = {};
  if (opts.timeoutMs) dispatchOpts.timeoutMs = opts.timeoutMs;

  const result = await dispatch<Record<string, unknown>, TOutput>(
    toolName, input, context, dispatchOpts,
  );
  const durationMs = Date.now() - start;

  plannerMetrics.recordPlan(context.runId, result.ok, durationMs);

  if (result.ok) {
    plannerLogger.task(context.runId, label, 'complete', { durationMs });
  } else {
    const errStr = resultError(result);
    plannerLogger.task(context.runId, label, 'fail', { error: errStr, durationMs });
    planningMonitor.recordFailure(context.runId, label, errStr, attempt);
  }

  return result;
}

/**
 * Dispatch multiple planning tools in parallel.
 * Individual failures do not abort sibling dispatches.
 */
export async function dispatchParallel<TOutput = unknown>(
  calls: Array<{
    toolName: string;
    input:    Record<string, unknown>;
    context:  ToolExecutionContext;
    opts?:    PlannerDispatchOptions;
  }>,
): Promise<Array<ToolExecutionResult<TOutput>>> {
  return Promise.all(
    calls.map((c) => dispatchTool<TOutput>(c.toolName, c.input, c.context, c.opts)),
  );
}

/**
 * Dispatch planning tools sequentially, stopping on first failure.
 */
export async function dispatchSequential<TOutput = unknown>(
  calls: Array<{
    toolName: string;
    input:    Record<string, unknown>;
    context:  ToolExecutionContext;
    opts?:    PlannerDispatchOptions;
  }>,
): Promise<Array<ToolExecutionResult<TOutput>>> {
  const results: Array<ToolExecutionResult<TOutput>> = [];
  for (const call of calls) {
    const result = await dispatchTool<TOutput>(
      call.toolName, call.input, call.context, call.opts,
    );
    results.push(result);
    if (!result.ok) break;
  }
  return results;
}

/** Build a ToolExecutionContext for a planner run. */
export function buildContext(
  runId:       string,
  projectId:   string,
  sandboxRoot: string,
  meta:        Record<string, unknown> = {},
  signal?:     AbortSignal,
): ToolExecutionContext {
  return Object.freeze({ runId, projectId, sandboxRoot, meta, signal });
}
