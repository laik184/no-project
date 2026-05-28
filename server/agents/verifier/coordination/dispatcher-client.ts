/**
 * server/agents/verifier/coordination/dispatcher-client.ts
 *
 * THE ONLY gateway from the verifier agent to the tool execution layer.
 * Every tool invocation MUST go through this module.
 * No spawn, exec, shell, fetch, or direct tool logic anywhere in agents/verifier.
 */

import {
  dispatch,
  type DispatchOptions,
} from '../../../tools/registry/tool-dispatcher.ts';
import type { ToolExecutionContext, ToolExecutionResult } from '../../../tools/registry/tool-types.ts';
import { verifierLogger }  from '../telemetry/verifier-logger.ts';
import { verifierMetrics } from '../telemetry/verifier-metrics.ts';
import { failureMonitor }  from '../monitoring/failure-monitor.ts';

export type { ToolExecutionContext, ToolExecutionResult };

export interface VerifierDispatchOptions {
  timeoutMs?: number;
  attempt?:   number;
  label?:     string;
}

// ── Type-safe result accessors ────────────────────────────────────────────────

type FailResult = { ok: false; error: string; code: string; durationMs: number };

export function resultError<T>(r: ToolExecutionResult<T>): string {
  return (r as unknown as FailResult).error ?? 'Unknown error';
}

export function resultOk<T>(r: ToolExecutionResult<T>): T {
  if (!r.ok) throw new Error(`Expected ok result but got error: ${resultError(r)}`);
  return (r as { ok: true; data: T }).data;
}

// ── Core dispatch ─────────────────────────────────────────────────────────────

export async function dispatchTool<TOutput = unknown>(
  toolName: string,
  input:    Record<string, unknown>,
  context:  ToolExecutionContext,
  opts:     VerifierDispatchOptions = {},
): Promise<ToolExecutionResult<TOutput>> {
  const start   = Date.now();
  const attempt = opts.attempt ?? 1;
  const label   = opts.label ?? toolName;

  verifierLogger.step(context.runId, label, 'start', { toolName, attempt });

  const dispatchOpts: DispatchOptions = {};
  if (opts.timeoutMs) dispatchOpts.timeoutMs = opts.timeoutMs;

  const result = await dispatch<Record<string, unknown>, TOutput>(toolName, input, context, dispatchOpts);
  const durationMs = Date.now() - start;

  if (result.ok) {
    verifierLogger.step(context.runId, label, 'complete', { durationMs });
  } else {
    const err = resultError(result);
    verifierLogger.step(context.runId, label, 'fail', { error: err, durationMs });
    failureMonitor.recordFailure(context.runId, label, toolName, err, attempt);
  }

  verifierMetrics.recordPhase(
    context.runId,
    (input.phase as string ?? 'build') as Parameters<typeof verifierMetrics.recordPhase>[1],
    durationMs,
    result.ok,
  );

  return result;
}

export async function dispatchParallel<TOutput = unknown>(
  calls: Array<{
    toolName: string;
    input:    Record<string, unknown>;
    context:  ToolExecutionContext;
    opts?:    VerifierDispatchOptions;
  }>,
): Promise<Array<ToolExecutionResult<TOutput>>> {
  return Promise.all(calls.map((c) => dispatchTool<TOutput>(c.toolName, c.input, c.context, c.opts)));
}

export function buildContext(
  runId:       string,
  projectId:   string,
  sandboxRoot: string,
  signal?:     AbortSignal,
): ToolExecutionContext {
  return Object.freeze({ runId, projectId, sandboxRoot, meta: {}, signal });
}
