/**
 * server/tools/coding/shared/coding-result.ts
 *
 * Convenience constructors that wrap coding generation outcomes
 * into ToolExecutionResult-compatible shapes for tool handlers.
 */

import type { ToolExecutionResult } from '../../registry/tool-types.ts';
import type { GenerationResult }    from './coding-types.ts';

export function codingOk(result: GenerationResult): ToolExecutionResult<GenerationResult> {
  return { ok: true, data: result, durationMs: 0 };
}

export function codingFail(error: string): ToolExecutionResult<never> {
  return { ok: false, error, code: 'EXECUTION_ERROR', durationMs: 0 };
}

export function codingValidationFail(error: string): ToolExecutionResult<never> {
  return { ok: false, error, code: 'VALIDATION_ERROR', durationMs: 0 };
}

export function codingTimeout(toolName: string, ms: number): ToolExecutionResult<never> {
  return {
    ok: false,
    error:      `[${toolName}] timed out after ${ms}ms`,
    code:       'TIMEOUT',
    durationMs: ms,
  };
}

export function emptyGeneration(summary: string): GenerationResult {
  return {
    files:            {},
    summary,
    strategy:         'template',
    validationPassed: true,
    warnings:         [],
  };
}

export function templateResult(
  files:    Record<string, string>,
  summary:  string,
  warnings: string[] = [],
): GenerationResult {
  return {
    files,
    summary,
    strategy:         'template',
    validationPassed: true,
    warnings,
  };
}

export function llmResult(
  files:            Record<string, string>,
  summary:          string,
  validationPassed: boolean,
  warnings:         string[] = [],
): GenerationResult {
  return { files, summary, strategy: 'llm', validationPassed, warnings };
}
