import type { ToolExecutionResult } from '../../registry/tool-types.ts';
import type { PhaseResult, VerificationStatus } from './verifier-types.ts';

export function phasePass(
  phase:      string,
  durationMs: number,
  output?:    string,
  warnings:   string[] = [],
): PhaseResult {
  return {
    phase:      phase as any,
    status:     'passed',
    durationMs,
    errors:     [],
    warnings,
    output,
  };
}

export function phaseFail(
  phase:      string,
  durationMs: number,
  errors:     string[],
  warnings:   string[] = [],
  output?:    string,
): PhaseResult {
  return {
    phase:      phase as any,
    status:     'failed',
    durationMs,
    errors,
    warnings,
    output,
  };
}

export function toToolOk<T>(data: T, durationMs: number): ToolExecutionResult<T> {
  return { ok: true, data, durationMs };
}

export function toToolFail(
  error:      string,
  durationMs: number,
  code:       'EXECUTION_ERROR' | 'TIMEOUT' | 'VALIDATION_ERROR' | 'PERMISSION_DENIED' = 'EXECUTION_ERROR',
): ToolExecutionResult<never> {
  return { ok: false, error, code, durationMs };
}

export function phaseResultToToolResult(
  result:     PhaseResult,
  durationMs: number,
): ToolExecutionResult<PhaseResult> {
  if (result.status === 'failed' && result.errors.length > 0) {
    return toToolFail(result.errors[0], durationMs);
  }
  return toToolOk(result, durationMs);
}
