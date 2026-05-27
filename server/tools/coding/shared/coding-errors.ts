/**
 * server/tools/coding/shared/coding-errors.ts
 *
 * Typed error classes for the coding tool layer.
 * All errors are fail-closed: they carry code + context for diagnostics.
 */

export type CodingErrorCode =
  | 'INVALID_INPUT'
  | 'GENERATION_FAILED'
  | 'VALIDATION_FAILED'
  | 'LLM_UNAVAILABLE'
  | 'LLM_PARSE_ERROR'
  | 'SYNTAX_ERROR'
  | 'IMPORT_ERROR'
  | 'SCHEMA_ERROR'
  | 'DEPENDENCY_ERROR'
  | 'UNKNOWN';

export class CodingToolError extends Error {
  constructor(
    public readonly code: CodingErrorCode,
    message: string,
  ) {
    super(`[CodingTool:${code}] ${message}`);
    this.name = 'CodingToolError';
  }
}

export function invalidInputError(field: string, reason: string): CodingToolError {
  return new CodingToolError('INVALID_INPUT', `"${field}": ${reason}`);
}

export function generationFailedError(context: string, reason: string): CodingToolError {
  return new CodingToolError('GENERATION_FAILED', `${context}: ${reason}`);
}

export function llmUnavailableError(): CodingToolError {
  return new CodingToolError(
    'LLM_UNAVAILABLE',
    'No LLM API key configured. Set OPENROUTER_API_KEY or AI_INTEGRATIONS_OPENROUTER_API_KEY.',
  );
}

export function llmParseError(detail: string): CodingToolError {
  return new CodingToolError('LLM_PARSE_ERROR', `Failed to parse LLM code response: ${detail}`);
}

export function syntaxError(file: string, detail: string): CodingToolError {
  return new CodingToolError('SYNTAX_ERROR', `Syntax error in "${file}": ${detail}`);
}

export function importError(file: string, detail: string): CodingToolError {
  return new CodingToolError('IMPORT_ERROR', `Import error in "${file}": ${detail}`);
}

export function schemaError(detail: string): CodingToolError {
  return new CodingToolError('SCHEMA_ERROR', `Schema validation error: ${detail}`);
}
