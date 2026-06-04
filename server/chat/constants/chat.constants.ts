export const MAX_MESSAGE_LENGTH       = 32_000;
export const MAX_ATTACHMENT_BYTES     = 20 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_RUN  = 10;
export const UPLOAD_DIR               = '.sandbox/uploads';
export const DEFAULT_RUN_MODE         = 'planned' as const;
export const MAX_TITLE_LENGTH         = 80;
export const DEFAULT_CONTEXT_WINDOW   = 40;
export const MAX_CONTEXT_WINDOW       = 120;
export const HISTORY_PAGE_SIZE        = 20;

export const ACCEPTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
] as const;

export const ACCEPTED_DOC_MIME_TYPES = [
  'application/pdf',
  'application/zip',
  'application/gzip',
  'application/x-tar',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
] as const;
