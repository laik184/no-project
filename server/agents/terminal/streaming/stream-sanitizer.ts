import { stripAnsi } from '../utils/stream-utils.ts';

const SECRET_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9]{20,}/g,
  /Bearer\s+[A-Za-z0-9\-._~+/]{20,}/gi,
  /[A-Za-z0-9]{32,}_secret/gi,
  /password\s*=\s*\S+/gi,
  /api[_-]?key\s*=\s*\S+/gi,
];

const REDACTED = '[REDACTED]';

export function sanitizeChunk(chunk: string): string {
  let result = stripAnsi(chunk);
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, REDACTED);
  }
  return result;
}

export function sanitizeLine(line: string): string {
  return sanitizeChunk(line);
}

export function containsSecret(text: string): boolean {
  return SECRET_PATTERNS.some((p) => {
    p.lastIndex = 0;
    return p.test(text);
  });
}
