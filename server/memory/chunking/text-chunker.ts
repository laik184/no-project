/**
 * server/memory/chunking/text-chunker.ts
 * Split plain text into fixed-size overlapping or non-overlapping chunks.
 */

export interface TextChunkOptions {
  chunkSize?: number;
  overlap?:   number;
}

export function chunkText(text: string, opts: TextChunkOptions = {}): string[] {
  const size    = opts.chunkSize ?? 512;
  const overlap = Math.min(opts.overlap ?? 0, size - 1);
  const step    = size - overlap;

  if (!text || text.trim().length === 0) return [];
  if (text.length <= size) return [text.trim()];

  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    const slice = text.slice(i, i + size).trim();
    if (slice.length > 0) chunks.push(slice);
    i += step;
  }
  return chunks;
}
