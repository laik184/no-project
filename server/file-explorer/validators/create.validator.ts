/**
 * server/file-explorer/validators/create.validator.ts
 * Validates the body of a create file/folder request.
 */

import type { CreateRequest } from '../contracts/index.ts';

export interface ValidationError { field: string; message: string; }
export interface ValidationResult { ok: boolean; errors: ValidationError[]; }

/** Returns ok=true if the CreateRequest body is valid. */
export function validateCreate(body: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  if (!body || typeof body !== 'object') {
    return { ok: false, errors: [{ field: 'body', message: 'Request body is required' }] };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.filePath !== 'string' || !b.filePath.trim()) {
    errors.push({ field: 'filePath', message: 'filePath is required and must be a non-empty string' });
  }
  if (b.isFolder !== undefined && typeof b.isFolder !== 'boolean') {
    errors.push({ field: 'isFolder', message: 'isFolder must be a boolean' });
  }
  if (b.content !== undefined && typeof b.content !== 'string') {
    errors.push({ field: 'content', message: 'content must be a string' });
  }
  return { ok: errors.length === 0, errors };
}

/** Narrows a validated body to CreateRequest. */
export function toCreateRequest(body: Record<string, unknown>): CreateRequest {
  return {
    filePath: (body.filePath as string).trim(),
    isFolder: body.isFolder as boolean | undefined,
    content:  body.content  as string | undefined,
  };
}
