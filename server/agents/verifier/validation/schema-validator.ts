/**
 * validation/schema-validator.ts
 * Validates data objects against field schema definitions.
 * Called by server/tools/verifier/validation/schema-validator.ts.
 */

import type { SchemaValidationResult } from '../types/validation.types.ts';

export interface SchemaField {
  key:       string;
  type:      'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
}

export function validateSchema(data: unknown, fields: SchemaField[]): SchemaValidationResult {
  const violations: string[] = [];

  if (data === null || data === undefined || typeof data !== 'object' || Array.isArray(data)) {
    const v = ['Data must be a non-null object'];
    return { valid: false, violations: v, errors: v, checkedAt: new Date() };
  }

  const obj = data as Record<string, unknown>;

  for (const field of fields) {
    const val = obj[field.key];

    if (field.required && (val === undefined || val === null)) {
      violations.push(`Required field missing: "${field.key}"`);
      continue;
    }

    if (val === undefined || val === null) continue;

    const actualType = Array.isArray(val) ? 'array' : typeof val;
    if (actualType !== field.type) {
      violations.push(`Field "${field.key}": expected ${field.type}, got ${actualType}`);
    }
  }

  return { valid: violations.length === 0, violations, errors: violations, checkedAt: new Date() };
}
