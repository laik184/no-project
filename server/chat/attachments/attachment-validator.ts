/**
 * attachment-validator.ts — Validates uploaded files before processing.
 * Pure validation — no I/O, no side effects.
 */
import { attachmentConstraints } from '../schemas/attachment.schema.ts';

export interface AttachmentValidationResult {
  valid:    boolean;
  errors:   string[];
}

export function validateAttachment(
  filename: string,
  mimeType: string,
  sizeBytes: number,
): AttachmentValidationResult {
  const errors: string[] = [];

  if (!filename || filename.trim().length === 0) {
    errors.push('Filename is required');
  }

  if (filename.length > 255) {
    errors.push('Filename exceeds 255 characters');
  }

  // Path traversal guard
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    errors.push('Filename must not contain path separators');
  }

  const accepted = attachmentConstraints.acceptedMime as readonly string[];
  if (!accepted.includes(mimeType)) {
    errors.push(
      `MIME type "${mimeType}" is not accepted. ` +
      `Accepted types: ${accepted.join(', ')}`,
    );
  }

  if (sizeBytes > attachmentConstraints.maxBytes) {
    const maxMb = attachmentConstraints.maxBytes / (1024 * 1024);
    const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(1);
    errors.push(`File size ${sizeMb} MB exceeds maximum of ${maxMb} MB`);
  }

  if (sizeBytes === 0) {
    errors.push('File is empty');
  }

  return { valid: errors.length === 0, errors };
}

/** Sanitize a filename — strip dangerous chars, normalize extension. */
export function sanitizeFilename(raw: string): string {
  return raw
    .replace(/[^\w.\-]/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 255);
}
