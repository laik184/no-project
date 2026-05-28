/**
 * server/agents/supervisor/coordination/dispatcher-client.ts
 *
 * THE ONLY gateway from the supervisor agent to the tool execution layer.
 * Every agent route invocation MUST go through this module.
 * No child_process, no spawn, no exec, no shell calls anywhere in agents/supervisor.
 */

import {
  dispatch,
  type DispatchOptions,
} from '../../../tools/registry/tool-dispatcher.ts';
import type { ToolExecutionContext, ToolExecutionResult } from '../../../tools/registry/tool-types.ts';
import { supervisorLogger }  from '../telemetry/supervisor-logger.ts';
import { supervisorMetrics } from '../telemetry/supervisor-metrics.ts';
import { failureMonitor }    from '../monitoring/failure-monitor.ts';
import type { AgentDomain }  from '../types/supervisor.types.ts';

export type { ToolExecutionContext, ToolExecutionResult };

export interface SupervisorDispatchOptions {
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
 * Dispatch a single supervision tool. Returns a typed ToolExecutionResult.
 * Never throws — all errors are captured in the result envelope.
 */
export async function dispatchTool<TOutput = unknown>(
  toolName: string,
  input:    Record<string, unknown>,
  context:  ToolExecutionContext,
  domain:   AgentDomain,
  opts:     SupervisorDispatchOptions = {},
): Promise<ToolExecutionResult<TOutput>> {
  const start   = Date.now();
  const attempt = opts.attempt ?? 1;
  const label   = opts.label ?? toolName;

  supervisorLogger.task(context.runId, label, 'dispatch', { toolName, domain, attempt });

  const dispatchOpts: DispatchOptions = {};
  if (opts.timeoutMs) dispatchOpts.timeoutMs = opts.timeoutMs;

  const result = await dispatch<Record<string, unknown>, TOutput>(
    toolName, input, context, dispatchOpts,
  );
  const durationMs = Date.now() - start;

  supervisorMetrics.recordTask(context.runId, result.ok, durationMs);

  if (result.ok) {
    supervisorLogger.task(context.runId, label, 'complete', { durationMs });
  } else {
    const errStr = resultError(result);
    supervisorLogger.task(context.runId, label, 'fail', { error: errStr, durationMs });
    failureMonitor.recordFailure(context.runId, label, domain, errStr, attempt);
  }

  return result;
}

/**
 * Dispatch multiple supervision tools in parallel.
 * Individual failures do not abort sibling dispatches.
 */
export async function dispatchParallel<TOutput = unknown>(
  calls: Array<{
    toolName: string;
    input:    Record<string, unknown>;
    context:  ToolExecutionContext;
    domain:   AgentDomain;
    opts?:    SupervisorDispatchOptions;
  }>,
): Promise<Array<ToolExecutionResult<TOutput>>> {
  return Promise.all(
    calls.map((c) => dispatchTool<TOutput>(c.toolName, c.input, c.context, c.domain, c.opts)),
  );
}

/**
 * Dispatch supervision tools sequentially, stopping on first failure.
 */
export async function dispatchSequential<TOutput = unknown>(
  calls: Array<{
    toolName: string;
    input:    Record<string, unknown>;
    context:  ToolExecutionContext;
    domain:   AgentDomain;
    opts?:    SupervisorDispatchOptions;
  }>,
): Promise<Array<ToolExecutionResult<TOutput>>> {
  const results: Array<ToolExecutionResult<TOutput>> = [];
  for (const call of calls) {
    const result = await dispatchTool<TOutput>(
      call.toolName, call.input, call.context, call.domain, call.opts,
    );
    results.push(result);
    if (!result.ok) break;
  }
  return results;
}

/** Build a ToolExecutionContext for a supervisor run. */
export function buildContext(
  runId:       string,
  projectId:   string,
  sandboxRoot: string,
  meta:        Record<string, unknown> = {},
  signal?:     AbortSignal,
): ToolExecutionContext {
  return Object.freeze({ runId, projectId, sandboxRoot, meta, signal });
}
