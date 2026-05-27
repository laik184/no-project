import path from 'path';
import { hasTraversal } from '../utils/filesystem-utils.ts';

export interface PathValidationResult {
  valid:  boolean;
  reason: string;
}

/** Validate a file path is safe for sandbox use. Fail-closed. */
export function validateFilePath(filePath: unknown): PathValidationResult {
  if (typeof filePath !== 'string' || filePath.trim().length === 0) {
    return { valid: false, reason: 'File path must be a non-empty string' };
  }

  if (hasTraversal(filePath)) {
    return { valid: false, reason: 'Path traversal detected (..)' };
  }

  if (path.isAbsolute(filePath)) {
    return { valid: false, reason: 'Absolute paths are not allowed inside sandbox' };
  }

  if (filePath.includes('\0')) {
    return { valid: false, reason: 'Null byte detected in path' };
  }

  if (filePath.length > 400) {
    return { valid: false, reason: 'Path exceeds maximum length' };
  }

  const dangerousSegments = ['/etc/', '/proc/', '/sys/', '/dev/', '/root/', '/var/'];
  for (const seg of dangerousSegments) {
    if (filePath.includes(seg)) {
      return { valid: false, reason: `Blocked system path: ${seg}` };
    }
  }

  return { valid: true, reason: 'ok' };
}

/** Validate that an absolute path stays within the sandbox root. */
export function checkSandboxBoundary(sandboxRoot: string, absolutePath: string): boolean {
  const resolvedRoot = path.resolve(sandboxRoot);
  const resolvedPath = path.resolve(absolutePath);
  return resolvedPath.startsWith(resolvedRoot + path.sep) || resolvedPath === resolvedRoot;
}

/** Validate file content is a non-null string and within size limits. */
export function validateFileContent(content: unknown): PathValidationResult {
  if (typeof content !== 'string') {
    return { valid: false, reason: 'File content must be a string' };
  }
  const MAX_BYTES = 1_048_576; // 1 MB
  if (Buffer.byteLength(content, 'utf8') > MAX_BYTES) {
    return { valid: false, reason: 'File content exceeds 1 MB limit' };
  }
  return { valid: true, reason: 'ok' };
}
