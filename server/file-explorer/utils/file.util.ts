/**
 * server/file-explorer/utils/file.util.ts
 * Utilities for file content analysis. No direct fs access — operates on Buffers/strings.
 */

/** Returns true if the buffer contains any null bytes (binary heuristic). */
export function hasBinaryContent(buf: Buffer): boolean {
  return buf.includes(0);
}

/** Attempts to decode buf as utf-8; falls back to latin1 if it fails. */
export function decodeBuffer(buf: Buffer): { content: string; encoding: 'utf-8' | 'latin1' } {
  try {
    // TextDecoder throws on invalid utf-8 sequences when fatal=true
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(buf);
    return { content: decoded, encoding: 'utf-8' };
  } catch {
    return { content: buf.toString('latin1'), encoding: 'latin1' };
  }
}

/** Counts newlines in a string to get line count. */
export function countLines(content: string): number {
  if (!content) return 0;
  let count = 1;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') count++;
  }
  return count;
}

/** Formats bytes to a human-readable string. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024)             return `${bytes} B`;
  if (bytes < 1024 * 1024)     return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Generates a short ISO timestamp string for history entry IDs. */
export function makeHistoryId(): string {
  return `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
