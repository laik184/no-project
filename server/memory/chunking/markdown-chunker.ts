/**
 * server/memory/chunking/markdown-chunker.ts
 * Chunk markdown documents by heading boundaries (h1–h3), then split any
 * oversized section so heading-free markdown cannot become one giant chunk.
 */

import { chunkText } from './text-chunker.ts';

export interface MarkdownChunkOptions {
  maxChunkSize?: number;
  overlap?:      number;
}

export function chunkMarkdown(text: string, opts: MarkdownChunkOptions = {}): string[] {
  if (!text || text.trim().length === 0) return [];

  const maxChunkSize = opts.maxChunkSize ?? 900;
  const overlap      = opts.overlap ?? 120;

  const parts = text.split(/\n(?=#{1,3}\s+)/);
  return parts
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .flatMap(p => p.length > maxChunkSize
      ? chunkText(p, { chunkSize: maxChunkSize, overlap })
      : [p]);
}
