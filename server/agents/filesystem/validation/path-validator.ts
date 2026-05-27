import { hasTraversal, hasNullByte, hasInvalidChars, isAbsoluteSystemPath } from '../utils/traversal-utils.ts';
import { isAbsolutePath, normalizePath } from '../utils/path-utils.ts';

export class PathValidationError extends Error {
  constructor(message: string, public readonly path: string) {
    super(`[path-validator] ${message}: "${path}"`);
    this.name = 'PathValidationError';
  }
}

export interface PathValidationResult {
  valid: boolean;
  error?: string;
}

const MAX_PATH_LENGTH = 4096;
const MAX_SEGMENT_LENGTH = 255;

function checkLength(p: string): string | null {
  if (p.length === 0) return 'Path must not be empty';
  if (p.length > MAX_PATH_LENGTH) return `Path exceeds maximum length of ${MAX_PATH_LENGTH}`;
  const segments = p.split('/').filter(Boolean);
  for (const seg of segments) {
    if (seg.length > MAX_SEGMENT_LENGTH) return `Path segment "${seg}" exceeds ${MAX_SEGMENT_LENGTH} chars`;
  }
  return null;
}

export function validatePath(p: string): PathValidationResult {
  if (!p || typeof p !== 'string') {
    return { valid: false, error: 'Path must be a non-empty string' };
  }
  const lengthErr = checkLength(p);
  if (lengthErr) return { valid: false, error: lengthErr };
  if (hasNullByte(p)) return { valid: false, error: 'Path contains null byte' };
  if (hasInvalidChars(p)) return { valid: false, error: 'Path contains invalid characters' };
  if (hasTraversal(p)) return { valid: false, error: 'Path contains directory traversal attempt (..)' };
  if (isAbsoluteSystemPath(p)) return { valid: false, error: 'Path points to a protected system directory' };
  return { valid: true };
}

export function assertPath(p: string): void {
  const result = validatePath(p);
  if (!result.valid) throw new PathValidationError(result.error!, p);
}

export function validateRelativePath(p: string): PathValidationResult {
  const base = validatePath(p);
  if (!base.valid) return base;
  if (isAbsolutePath(p)) return { valid: false, error: 'Expected a relative path but received an absolute path' };
  return { valid: true };
}

export function assertRelativePath(p: string): void {
  const result = validateRelativePath(p);
  if (!result.valid) throw new PathValidationError(result.error!, p);
}

export function validateFilename(name: string): PathValidationResult {
  if (!name || typeof name !== 'string') return { valid: false, error: 'Filename must be non-empty' };
  if (name.includes('/') || name.includes('\\')) return { valid: false, error: 'Filename must not contain path separators' };
  if (name === '.' || name === '..') return { valid: false, error: 'Filename must not be . or ..' };
  if (hasNullByte(name)) return { valid: false, error: 'Filename contains null byte' };
  if (hasInvalidChars(name)) return { valid: false, error: 'Filename contains invalid characters' };
  if (name.length > MAX_SEGMENT_LENGTH) return { valid: false, error: `Filename exceeds ${MAX_SEGMENT_LENGTH} chars` };
  return { valid: true };
}

export function assertFilename(name: string): void {
  const result = validateFilename(name);
  if (!result.valid) throw new PathValidationError(result.error!, name);
}
