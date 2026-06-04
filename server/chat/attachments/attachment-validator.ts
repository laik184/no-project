import { ACCEPTED_IMAGE_MIME_TYPES, ACCEPTED_DOC_MIME_TYPES, MAX_ATTACHMENT_BYTES } from '../constants/chat.constants.ts';

const ALL_ACCEPTED = [
  ...(ACCEPTED_IMAGE_MIME_TYPES as readonly string[]),
  ...(ACCEPTED_DOC_MIME_TYPES  as readonly string[]),
];

export interface AttachmentValidationResult {
  valid:    boolean;
  errors:   string[];
}

export function validateAttachment(
  mimeType:  string,
  sizeBytes: number,
): AttachmentValidationResult {
  const errors: string[] = [];
  if (!ALL_ACCEPTED.includes(mimeType)) {
    errors.push(`Unsupported MIME type: ${mimeType}`);
  }
  if (sizeBytes > MAX_ATTACHMENT_BYTES) {
    errors.push(`File too large: ${(sizeBytes / 1024 / 1024).toFixed(1)} MB (max ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB)`);
  }
  return { valid: errors.length === 0, errors };
}

export function isImage(mimeType: string): boolean {
  return (ACCEPTED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);
}
