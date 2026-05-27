import type { ValidationResult } from '../types/execution.types.ts';
import { estimateBytes } from '../utils/stream-utils.ts';

const MAX_STREAM_BYTES = 10 * 1024 * 1024; // 10 MB

export function validateStreamChunk(chunk: string): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (chunk.includes('\0')) {
    warnings.push('Stream chunk contains null bytes');
  }
  if (estimateBytes(chunk) > 1_000_000) {
    warnings.push('Single stream chunk is very large (>1MB)');
  }

  return { valid: true, errors, warnings };
}

export function validateStreamSize(bytesSoFar: number): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (bytesSoFar >= MAX_STREAM_BYTES) {
    errors.push(`Stream exceeds max size (${MAX_STREAM_BYTES} bytes)`);
  } else if (bytesSoFar > MAX_STREAM_BYTES * 0.8) {
    warnings.push('Stream approaching max size limit');
  }

  return { valid: bytesSoFar < MAX_STREAM_BYTES, errors, warnings };
}

export function isStreamHealthy(truncated: boolean, exitCode: number): boolean {
  return !truncated && exitCode === 0;
}
