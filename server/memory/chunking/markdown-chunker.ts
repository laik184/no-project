/**
 * server/memory/chunking/markdown-chunker.ts
 * Chunk markdown documents by heading boundaries (h1–h3).
 */

export function chunkMarkdown(text: string): string[] {
  if (!text || text.trim().length === 0) return [];

  const parts = text.split(/\n(?=#{1,3}\s+)/);
  return parts
    .map(p => p.trim())
    .filter(p => p.length > 0);
}
