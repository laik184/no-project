/**
 * server/tools/browser/shared/browser-result.ts
 *
 * Convenience constructors that wrap browser operation outcomes
 * into ToolExecutionResult-compatible shapes for tool handlers.
 */

import type { ToolExecutionResult } from '../../registry/tool-types.ts';

export function browserOk<T>(data: T): ToolExecutionResult<T> {
  return { ok: true, data, durationMs: 0 };
}

export function browserFail(error: string): ToolExecutionResult<never> {
  return { ok: false, error, code: 'EXECUTION_ERROR', durationMs: 0 };
}

export function browserNotFound(error: string): ToolExecutionResult<never> {
  return { ok: false, error, code: 'NOT_FOUND', durationMs: 0 };
}

export function browserValidationFail(error: string): ToolExecutionResult<never> {
  return { ok: false, error, code: 'VALIDATION_ERROR', durationMs: 0 };
}

export function browserTimeout(toolName: string, ms: number): ToolExecutionResult<never> {
  return {
    ok: false,
    error: `[${toolName}] timed out after ${ms}ms`,
    code: 'TIMEOUT',
    durationMs: ms,
  };
}
