import type { SchemaValidationResult } from '../types/validation.types.ts';

export interface HttpResponseSpec {
  status:         number;
  expectedStatus: number;
  body?:          unknown;
  contentType?:   string;
}

export interface ResponseValidationResult {
  valid:          boolean;
  errors:         string[];
  statusOk:       boolean;
  bodyOk:         boolean;
}

export function validateHttpResponse(spec: HttpResponseSpec): ResponseValidationResult {
  const errors: string[] = [];

  const statusOk = spec.status === spec.expectedStatus;
  if (!statusOk) {
    errors.push(`Expected status ${spec.expectedStatus}, got ${spec.status}`);
  }

  let bodyOk = true;
  if (spec.body !== undefined && spec.body === null) {
    errors.push('Response body is null');
    bodyOk = false;
  }

  return { valid: errors.length === 0, errors, statusOk, bodyOk };
}

export function validateJsonBody(body: unknown, requiredFields: string[]): SchemaValidationResult {
  if (typeof body !== 'object' || body === null) {
    return { valid: false, errors: ['Response body is not a JSON object'] };
  }

  const errors: string[] = [];
  for (const field of requiredFields) {
    if (!(field in (body as Record<string, unknown>))) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateStatusRange(status: number, min: number, max: number): boolean {
  return status >= min && status <= max;
}
