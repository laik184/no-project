/**
 * server/file-explorer/validators/upload.validator.ts
 * Validates a multipart upload request.
 */

import type { ValidationResult } from './create.validator.ts';

export function validateUpload(files: Express.Multer.File[] | undefined): ValidationResult {
  if (!files || files.length === 0) {
    return { ok: false, errors: [{ field: 'files', message: 'At least one file is required' }] };
  }
  const errors = [];
  for (const f of files) {
    if (!f.originalname || !f.originalname.trim()) {
      errors.push({ field: 'files', message: `File is missing originalname` });
    }
    if (!f.buffer || f.buffer.length === 0) {
      errors.push({ field: 'files', message: `File "${f.originalname}" has empty buffer` });
    }
  }
  return { ok: errors.length === 0, errors };
}
