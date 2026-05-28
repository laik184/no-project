/**
 * validation/response-validator.ts
 * Validates tool dispatch responses at the orchestration layer.
 */

import type { ToolExecutionResult } from '../../../tools/registry/tool-types.ts';
import { resultError } from '../coordination/dispatcher-client.ts';

export interface ResponseValidation<T> {
  valid:    boolean;
  data?:    T;
  errors:   string[];
}

export function validateToolResponse<T>(
  result:        ToolExecutionResult<T>,
  toolName:      string,
  required = true,
): ResponseValidation<T> {
  if (!result.ok) {
    const msg = `Tool "${toolName}" failed: ${resultError(result)}`;
    return { valid: !required, errors: required ? [msg] : [] };
  }

  if (result.data === undefined || result.data === null) {
    const msg = `Tool "${toolName}" returned no data`;
    return { valid: !required, data: undefined, errors: required ? [msg] : [] };
  }

  return { valid: true, data: result.data, errors: [] };
}

export function validateRequiredFields<T extends object>(
  data:   T,
  fields: (keyof T)[],
  label:  string,
): ResponseValidation<T> {
  const errors: string[] = [];
  for (const field of fields) {
    if (data[field] === undefined || data[field] === null) {
      errors.push(`[${label}] Required field missing: "${String(field)}"`);
    }
  }
  return { valid: errors.length === 0, data: errors.length === 0 ? data : undefined, errors };
}

export function isSuccessResponse(result: ToolExecutionResult): boolean {
  return result.ok && (result as { ok: true; data: unknown; durationMs: number }).data !== undefined;
}

export function extractOrDefault<T>(result: ToolExecutionResult<T>, defaultValue: T): T {
  return result.ok ? result.data : defaultValue;
}

export function extractErrors(result: ToolExecutionResult): string[] {
  if (!result.ok) return [resultError(result)];
  return [];
}
