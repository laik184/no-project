/**
 * server/tools/filesystem/validation/operation-validator.ts
 *
 * Higher-level operation validators for the tools layer.
 * Validates tool input shapes before dispatch.
 */

import { assertRelativePath } from '../lib/validation/path-validator.ts';

export interface OpValidationResult {
  valid:  boolean;
  error?: string;
}

export function validateStringInput(
  value:     unknown,
  fieldName: string,
): OpValidationResult {
  if (typeof value !== 'string' || !value.trim()) {
    return { valid: false, error: `"${fieldName}" must be a non-empty string` };
  }
  return { valid: true };
}

export function validatePathInput(
  value:     unknown,
  fieldName: string = 'path',
): OpValidationResult {
  const strResult = validateStringInput(value, fieldName);
  if (!strResult.valid) return strResult;

  try {
    assertRelativePath(value as string);
    return { valid: true };
  } catch (err) {
    return { valid: false, error: (err as Error).message };
  }
}

export function validateLineNumber(
  value:     unknown,
  fieldName: string = 'lineNumber',
): OpValidationResult {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    return { valid: false, error: `"${fieldName}" must be a positive integer` };
  }
  return { valid: true };
}

export function assertInputString(value: unknown, fieldName: string): string {
  const r = validateStringInput(value, fieldName);
  if (!r.valid) throw new Error(r.error!);
  return value as string;
}

export function assertInputStringAllowEmpty(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`"${fieldName}" must be a string`);
  }
  return value;
}

export function assertInputPath(value: unknown, fieldName = 'path'): string {
  const r = validatePathInput(value, fieldName);
  if (!r.valid) throw new Error(r.error!);
  return value as string;
}
