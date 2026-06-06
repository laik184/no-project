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
  return chunks.filter(c => c.length > 0);
}
