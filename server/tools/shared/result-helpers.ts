/**
 * server/tools/shared/result-helpers.ts
 *
 * Convenience constructors for ToolExecutionResult.
 * Use these in tool handlers to produce normalized outputs.
 */

import type { ToolExecutionResult, ToolErrorCode } from '../registry/tool-types.ts';

export function ok<T>(data: T, durationMs = 0): ToolExecutionResult<T> {
  return { ok: true, data, durationMs };
}

export function fail(
  error:     string,
  code:      ToolErrorCode = 'EXECUTION_ERROR',
  durationMs = 0,
): ToolExecutionResult<never> {
  return { ok: false, error, code, durationMs };
}

export function isOk<T>(result: ToolExecutionResult<T>): result is Extract<ToolExecutionResult<T>, { ok: true }> {
  return result.ok === true;
}

export function isFail<T>(result: ToolExecutionResult<T>): result is Extract<ToolExecutionResult<T>, { ok: false }> {
  return result.ok === false;
}

export function unwrapOrThrow<T>(result: ToolExecutionResult<T>): T {
  if (result.ok) return result.data;
  const r = result as Extract<ToolExecutionResult<T>, { ok: false }>;
  throw new Error(r.error);
}

export function unwrapOrDefault<T>(result: ToolExecutionResult<T>, defaultValue: T): T {
  return result.ok ? result.data : defaultValue;
}
