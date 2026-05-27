import type { SchemaValidationResult } from '../types/validation.types.ts';

type JsonPrimitive = string | number | boolean | null;
type JsonValue     = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface SchemaField {
  key:        string;
  type:       'string' | 'number' | 'boolean' | 'object' | 'array' | 'any';
  required?:  boolean;
  minLength?: number;
  min?:       number;
  max?:       number;
}

export function validateSchema(
  data:   unknown,
  fields: SchemaField[],
): SchemaValidationResult {
  const errors: string[] = [];

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { valid: false, errors: ['Input must be a non-null object'] };
  }

  const obj = data as Record<string, JsonValue>;

  for (const field of fields) {
    const value = obj[field.key];

    if (field.required && (value === undefined || value === null)) {
      errors.push(`Required field missing: "${field.key}"`);
      continue;
    }

    if (value === undefined || value === null) continue;

    if (field.type !== 'any') {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== field.type) {
        errors.push(`Field "${field.key}" expected ${field.type}, got ${actualType}`);
      }
    }

    if (field.type === 'string' && typeof value === 'string' && field.minLength !== undefined) {
      if (value.length < field.minLength) {
        errors.push(`Field "${field.key}" too short (min ${field.minLength})`);
      }
    }

    if (field.type === 'number' && typeof value === 'number') {
      if (field.min !== undefined && value < field.min) {
        errors.push(`Field "${field.key}" below min (${field.min})`);
      }
      if (field.max !== undefined && value > field.max) {
        errors.push(`Field "${field.key}" above max (${field.max})`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateRequiredFields(obj: unknown, fields: string[]): SchemaValidationResult {
  if (typeof obj !== 'object' || obj === null) {
    return { valid: false, errors: ['Input is not an object'] };
  }
  const errors = fields
    .filter((f) => !(f in (obj as Record<string, unknown>)))
    .map((f) => `Missing required field: "${f}"`);
  return { valid: errors.length === 0, errors };
}
