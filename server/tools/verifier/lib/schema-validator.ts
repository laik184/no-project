import type { SchemaValidationResult } from './verifier-types.ts';

export interface SchemaField {
  key:      string;
  type:     'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
}

export function validateSchema(data: unknown, fields: SchemaField[]): SchemaValidationResult {
  const errors: string[] = [];
  if (data == null || typeof data !== 'object') {
    return { valid: false, errors: ['Data must be a non-null object'] };
  }
  const obj = data as Record<string, unknown>;
  for (const field of fields) {
    const val = obj[field.key];
    if (field.required && val === undefined) {
      errors.push(`Missing required field: "${field.key}"`);
      continue;
    }
    if (val !== undefined) {
      const actualType = Array.isArray(val) ? 'array' : typeof val;
      if (actualType !== field.type) {
        errors.push(`Field "${field.key}": expected ${field.type}, got ${actualType}`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}
