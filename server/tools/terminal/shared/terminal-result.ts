import type { ToolExecutionResult } from '../../registry/tool-types.ts';
import type { ExecutionResult } from './terminal-types.ts';

export function toToolResult<T>(
  data:       T,
  durationMs: number,
): ToolExecutionResult<T> {
  return { ok: true, data, durationMs };
}

export function toToolError(
  error:      string,
  durationMs: number,
  code:       'EXECUTION_ERROR' | 'TIMEOUT' | 'VALIDATION_ERROR' | 'PERMISSION_DENIED' = 'EXECUTION_ERROR',
): ToolExecutionResult<never> {
  return { ok: false, error, code, durationMs };
}

export function executionToToolResult(
  result:     ExecutionResult,
  durationMs: number,
): ToolExecutionResult<ExecutionResult> {
  if (!result.success) {
    return toToolError(
      result.stderr || `Exit code ${result.exitCode}`,
      durationMs,
      result.timedOut ? 'TIMEOUT' : 'EXECUTION_ERROR',
    );
  }
  return toToolResult(result, durationMs);
}
