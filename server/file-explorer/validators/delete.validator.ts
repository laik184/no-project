/**
 * server/file-explorer/validators/delete.validator.ts
 * Validates the body of a delete request.
 */

import type { DeleteRequest } from '../contracts/index.ts';
import type { ValidationError, ValidationResult } from './create.validator.ts';

export function validateDelete(body: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  if (!body || typeof body !== 'object') {
    return { ok: false, errors: [{ field: 'body', message: 'Request body is required' }] };
  }
  const b = body as Record<string, unknown>;
  if (typeof b.targetPath !== 'string' || !b.targetPath.trim()) {
    errors.push({ field: 'targetPath', message: 'targetPath is required' });
  }
  return { ok: errors.length === 0, errors };
}

export function toDeleteRequest(body: Record<string, unknown>): DeleteRequest {
  return { targetPath: (body.targetPath as string).trim() };
}
