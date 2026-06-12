/**
 * server/memory/chunking/code-chunker.ts
 * Chunk source code preserving function/class/export boundaries.
 */

export interface CodeChunkOptions {
  maxChunkSize?: number;
}

const BOUNDARY_RE = /^(?:export\s+)?(?:async\s+)?(?:function\s+\w|class\s+\w|const\s+\w+\s*=\s*(?:async\s+)?\(|interface\s+\w|type\s+\w+\s*=)/m;

export function chunkCode(source: string, opts: CodeChunkOptions = {}): string[] {
  const maxSize = opts.maxChunkSize ?? 800;
  const lines   = source.split('\n');
  const chunks: string[] = [];
  let current = '';

  for (const line of lines) {
    const wouldExceed = current.length + line.length + 1 > maxSize;
    const isBoundary  = BOUNDARY_RE.test(line);

    if (wouldExceed && isBoundary && current.trim().length > 0) {
      chunks.push(current.trim());
      current = line + '\n';
    } else {
      current += line + '\n';
    }
  }

  if (current.trim().length > 0) chunks.push(current.trim());
  return chunks
    .flatMap(c => splitOversizedCodeChunk(c, maxSize))
    .filter(c => c.length > 0);
}

function splitOversizedCodeChunk(chunk: string, maxSize: number): string[] {
  if (chunk.length <= maxSize) return [chunk];

  const parts: string[] = [];
  let current = '';
  for (const line of chunk.split('\n')) {
    if (current.length + line.length + 1 > maxSize && current.trim().length > 0) {
      parts.push(current.trim());
      current = '';
    }

    if (line.length > maxSize) {
      for (let i = 0; i < line.length; i += maxSize) {
        const slice = line.slice(i, i + maxSize).trim();
        if (slice.length > 0) parts.push(slice);
      }
    } else {
      current += line + '\n';
    }
  }

  if (current.trim().length > 0) parts.push(current.trim());
  return parts;
}
