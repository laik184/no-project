/**
 * server/file-explorer/validators/rename.validator.ts
 * Validates the body of a rename request.
 */

import type { RenameRequest } from '../contracts/index.ts';
import type { ValidationError, ValidationResult } from './create.validator.ts';

export function validateRename(body: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  if (!body || typeof body !== 'object') {
    return { ok: false, errors: [{ field: 'body', message: 'Request body is required' }] };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.oldPath !== 'string' || !b.oldPath.trim()) {
    errors.push({ field: 'oldPath', message: 'oldPath is required' });
  }
  if (typeof b.newPath !== 'string' || !b.newPath.trim()) {
    errors.push({ field: 'newPath', message: 'newPath is required' });
  }
  if (typeof b.oldPath === 'string' && typeof b.newPath === 'string' && b.oldPath === b.newPath) {
    errors.push({ field: 'newPath', message: 'newPath must differ from oldPath' });
  }
  return { ok: errors.length === 0, errors };
}

export function toRenameRequest(body: Record<string, unknown>): RenameRequest {
  return {
    oldPath: (body.oldPath as string).trim(),
    newPath: (body.newPath as string).trim(),
  };
}
