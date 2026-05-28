/**
 * coordination/dispatcher-client.ts
 *
 * THE ONLY gateway from the verifier agent to the tool execution layer.
 * All tool invocations MUST go through this module.
 * No direct fs, child_process, Playwright, or tsc calls anywhere in agents/verifier.
 */

import {
  dispatch,
  type DispatchOptions,
} from '../../../tools/registry/tool-dispatcher.ts';
import type { ToolExecutionContext, ToolExecutionResult } from '../../../tools/registry/tool-types.ts';
import { verifierLogger }  from '../telemetry/verifier-logger.ts';
import { verifierMetrics } from '../telemetry/verifier-metrics.ts';
import { executionTrace }  from '../telemetry/execution-trace.ts';
import { executionHistory } from '../state/execution-history.ts';
import type { VerificationPhase } from '../types/verifier.types.ts';

export type { ToolExecutionContext, ToolExecutionResult };

export interface VerifierDispatchOptions {
  phase?:     VerificationPhase;
  timeoutMs?: number;
  attempt?:   number;
}

// ── Type-safe failure result helpers ─────────────────────────────────────────
// With strict:false (no strictNullChecks), TypeScript doesn't narrow
// discriminated unions via `if (!r.ok)`. Use these explicit cast helpers instead.

type FailResult = { ok: false; error: string; code: string; durationMs: number };

/** Extract the error string from a failed result. Safe: always check result.ok first. */
export function resultError<T>(r: ToolExecutionResult<T>): string {
  return (r as unknown as FailResult).error ?? '';
}

/** Extract the error string or undefined for a successful result. */
export function resultErrorOrUndefined<T>(r: ToolExecutionResult<T>): string | undefined {
  if (r.ok) return undefined;
  return (r as unknown as FailResult).error ?? undefined;
}

/**
 * Dispatch a single verifier tool. Returns a typed ToolExecutionResult.
 * Never throws — all errors are captured in the result.
 */
export async function dispatchTool<TOutput = unknown>(
  toolName: string,
  input:    Record<string, unknown>,
  context:  ToolExecutionContext,
  opts:     VerifierDispatchOptions = {},
): Promise<ToolExecutionResult<TOutput>> {
  const start = Date.now();
  const phase = opts.phase ?? 'validation';

  verifierLogger.step(context.runId, toolName, 'dispatch', { phase, attempt: opts.attempt ?? 1 });
  executionTrace.record(context.runId, phase, 'dispatch', { toolName, meta: { attempt: opts.attempt ?? 1 } });

  const dispatchOpts: DispatchOptions = {};
  if (opts.timeoutMs) dispatchOpts.timeoutMs = opts.timeoutMs;

  const result = await dispatch<Record<string, unknown>, TOutput>(toolName, input, context, dispatchOpts);
  const durationMs = Date.now() - start;

  const isOk  = result.ok;
  const errStr = isOk ? undefined : resultError(result);

  verifierMetrics.recordDispatch(context.runId, toolName, durationMs, isOk);
  executionHistory.recordDispatch(context.runId, {
    toolName,
    attempt:    opts.attempt ?? 1,
    ok:         isOk,
    durationMs,
    error:      errStr,
  });

  if (isOk) {
    verifierLogger.step(context.runId, toolName, 'complete', { durationMs });
    executionTrace.record(context.runId, phase, 'complete', { toolName, durationMs });
  } else {
    verifierLogger.step(context.runId, toolName, 'fail', { error: errStr, durationMs });
    executionTrace.record(context.runId, phase, 'fail', { toolName, meta: { error: errStr } });
  }

  return result;
}

/**
 * Dispatch multiple tools in parallel. Individual failures do not abort siblings.
 */
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

/**
 * Dispatch tools in sequence, stopping on first failure.
 */
export async function dispatchSequential<TOutput = unknown>(
  calls: Array<{
    toolName: string;
    input:    Record<string, unknown>;
    context:  ToolExecutionContext;
    opts?:    VerifierDispatchOptions;
  }>,
): Promise<Array<ToolExecutionResult<TOutput>>> {
  const results: Array<ToolExecutionResult<TOutput>> = [];
  for (const call of calls) {
    const result = await dispatchTool<TOutput>(call.toolName, call.input, call.context, call.opts);
    results.push(result);
    if (!result.ok) break;
  }
  return results;
}

/** Build a ToolExecutionContext from verifier inputs. */
export function buildContext(
  runId:       string,
  projectId:   string,
  sandboxRoot: string,
  meta:        Record<string, unknown> = {},
  signal?:     AbortSignal,
): ToolExecutionContext {
  return { runId, projectId, sandboxRoot, meta, signal };
}
