/**
 * file-processor.ts — Non-image document attachment processing.
 * Extracts text content or metadata useful for LLM context injection.
 */
import path from 'path';

export interface FileProcessResult {
  filename:    string;
  mimeType:    string;
  sizeBytes:   number;
  textContent: string | null;  // extracted text (null if binary)
  truncated:   boolean;
}

const MAX_TEXT_CHARS = 50_000; // ~12k tokens

/**
 * Extract text content from document uploads.
 * Supports plain-text types only — binary formats (PDF, ZIP) return null.
 */
export function processFileAttachment(
  filename:  string,
  mimeType:  string,
  data:      Buffer,
): FileProcessResult {
  const ext = path.extname(filename).toLowerCase();

  const textMimeTypes = [
    'text/plain',
    'text/csv',
    'text/markdown',
    'application/json',
  ];

  const textExtensions = ['.txt', '.md', '.csv', '.json', '.ts', '.js', '.py', '.rs', '.go'];

  const isText = textMimeTypes.includes(mimeType) || textExtensions.includes(ext);

  if (!isText) {
    return {
      filename,
      mimeType,
      sizeBytes:   data.length,
      textContent: null,
      truncated:   false,
    };
  }

  const full      = data.toString('utf8');
  const truncated = full.length > MAX_TEXT_CHARS;
  const text      = truncated ? full.slice(0, MAX_TEXT_CHARS) + '\n\n[... truncated]' : full;

  return {
    filename,
    mimeType,
    sizeBytes:   data.length,
    textContent: text,
    truncated,
  };
}

/**
 * Format a processed file for LLM context injection.
 */
export function formatForContext(result: FileProcessResult): string {
  if (!result.textContent) {
    return `[Attachment: ${result.filename} (${result.mimeType}, ${result.sizeBytes} bytes) — binary, not included in context]`;
  }
  return `<attachment name="${result.filename}">\n${result.textContent}\n</attachment>`;
}
