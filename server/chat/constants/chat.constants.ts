/** Maximum characters allowed in a single user message. */
export const MAX_MESSAGE_LENGTH = 32_000;

/** Maximum file size for chat attachments (20 MB). */
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

/** Maximum number of attachments per run. */
export const MAX_ATTACHMENTS_PER_RUN = 10;

/** Directory where chat uploads are stored (relative to cwd). */
export const UPLOAD_DIR = '.sandbox/uploads';

/** Default run mode when not specified by caller. */
export const DEFAULT_RUN_MODE = 'planned' as const;

/** Maximum characters in an auto-generated conversation title. */
export const MAX_TITLE_LENGTH = 80;

/** Default context window message count (LLM context budget). */
export const DEFAULT_CONTEXT_WINDOW = 40;

/** Maximum context window message count. */
export const MAX_CONTEXT_WINDOW = 120;

/** Accepted MIME types for image uploads. */
export const ACCEPTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
] as const;

/** Accepted MIME types for document uploads. */
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

/** Chat history page size. */
export const HISTORY_PAGE_SIZE = 20;
