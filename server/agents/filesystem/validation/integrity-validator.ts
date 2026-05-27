import { getFileStat } from '../utils/filesystem-utils.ts';

export class IntegrityValidationError extends Error {
  constructor(message: string) {
    super(`[integrity-validator] ${message}`);
    this.name = 'IntegrityValidationError';
  }
}

export interface ContentValidationResult {
  valid: boolean;
  error?: string;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_CONTENT_LENGTH = 10 * 1024 * 1024;  // 10 MB string

const BINARY_DETECTION_SAMPLE = 512;

function looksLikeBinary(content: string): boolean {
  const sample = content.slice(0, BINARY_DETECTION_SAMPLE);
  let nonPrintable = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    if (code < 9 || (code > 13 && code < 32)) nonPrintable++;
  }
  return nonPrintable / sample.length > 0.1;
}

export function validateFileContent(content: string): ContentValidationResult {
  if (typeof content !== 'string') {
    return { valid: false, error: 'Content must be a string' };
  }
  if (content.includes('\0')) {
    return { valid: false, error: 'Content contains null bytes — possible binary file' };
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return { valid: false, error: `Content exceeds maximum size of ${MAX_CONTENT_LENGTH} bytes` };
  }
  if (content.length > 0 && looksLikeBinary(content)) {
    return { valid: false, error: 'Content appears to be binary — only text files are supported' };
  }
  return { valid: true };
}

export function assertFileContent(content: string): void {
  const result = validateFileContent(content);
  if (!result.valid) throw new IntegrityValidationError(result.error!);
}

export async function validateFileSize(absolutePath: string): Promise<ContentValidationResult> {
  try {
    const stat = await getFileStat(absolutePath);
    if (stat.size > MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        error: `File size ${stat.size} bytes exceeds limit of ${MAX_FILE_SIZE_BYTES} bytes`,
      };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: `Cannot stat file: ${absolutePath}` };
  }
}

export async function assertFileSize(absolutePath: string): Promise<void> {
  const result = await validateFileSize(absolutePath);
  if (!result.valid) throw new IntegrityValidationError(result.error!);
}

export function validateLineRange(content: string, from: number, to: number): ContentValidationResult {
  const lines = content.split('\n');
  if (from < 1) return { valid: false, error: 'Line range "from" must be >= 1' };
  if (to < from) return { valid: false, error: 'Line range "to" must be >= "from"' };
  if (to > lines.length) {
    return { valid: false, error: `Line range "to" (${to}) exceeds file length (${lines.length})` };
  }
  return { valid: true };
}
