/**
 * server/tools/shared/input-validator.ts
 *
 * Lightweight input validation against a ToolInputSchema.
 * No runtime Zod dependency — pure structural checks only.
 */

import type { ToolInputSchema } from '../registry/tool-types.ts';

export interface ValidationResult {
  valid:  boolean;
  errors: string[];
}

export function validateInput(
  input:  Record<string, unknown>,
  schema: ToolInputSchema,
): ValidationResult {
  const errors: string[] = [];

  for (const [field, def] of Object.entries(schema)) {
    const value = input[field];

    if (def.required && (value === undefined || value === null)) {
      errors.push(`Field "${field}" is required.`);
      continue;
    }

    if (value === undefined || value === null) continue;

    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== def.type) {
      errors.push(
        `Field "${field}" must be of type "${def.type}", got "${actualType}".`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

export function applyDefaults(
  input:  Record<string, unknown>,
  schema: ToolInputSchema,
): Record<string, unknown> {
  const result = { ...input };
  for (const [field, def] of Object.entries(schema)) {
    if (result[field] === undefined && def.default !== undefined) {
      result[field] = def.default;
    }
  }
  return result;
}
